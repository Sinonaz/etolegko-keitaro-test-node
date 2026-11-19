import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { KeitaroClient } from '../keitaro/keitaro.client';
import { KeitaroError } from '../keitaro/keitaro.exceptions';
import {
  StreamDraft,
  StreamDraftDocument,
  StreamOfferDraft,
} from './schemas/stream-draft.schema';
import { OfferShare, redistribute } from './weights';

type JsonDict = Record<string, unknown>;

export class StreamServiceError extends KeitaroError {
  constructor(message: string) {
    super(message);
    this.name = 'StreamServiceError';
  }
}

@Injectable()
export class StreamsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(StreamDraft.name)
    private readonly draftModel: Model<StreamDraftDocument>,
    private readonly keitaro: KeitaroClient,
    private readonly config: ConfigService,
  ) {}

  async getEditor(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    return this.buildEditorResponse(campaign);
  }

  async fetchStreams(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    const remoteStreams = await this.keitaro.listCampaignStreams(
      campaign.keitaro_campaign_id,
    );

    await this.draftModel.deleteMany({ campaign_id: campaign.id }).exec();

    for (const stream of remoteStreams) {
      const streamId = Number(stream.id);
      const editable = isEditableStream(stream);
      const offerRows: StreamOfferDraft[] = [];
      const rawOffers = Array.isArray(stream.offers) ? stream.offers : [];

      for (let index = 0; index < rawOffers.length; index++) {
        const raw = rawOffers[index];
        if (!raw || typeof raw !== 'object') continue;
        const dict = raw as JsonDict;
        const oid = offerIdFromKt(dict);
        if (oid == null) continue;
        const state = String(dict.state ?? 'active').toLowerCase();
        const removed = state === 'disabled' || state === 'deleted';
        const share = Number(dict.share ?? 0);
        offerRows.push({
          offer_id: oid,
          offer_name: offerNameFromKt(dict),
          share: removed ? 0 : share,
          pinned: false,
          removed,
          sort_order: index,
        });
      }

      if (editable && offerRows.length) {
        applyWeights(offerRows);
      }

      await this.draftModel.create({
        id: randomUUID(),
        campaign_id: campaign.id,
        keitaro_stream_id: streamId,
        name: String(stream.name ?? `Stream ${streamId}`),
        stream_type: String(stream.type ?? 'regular'),
        position: Number(stream.position ?? 0),
        stream_schema: String(stream.schema ?? ''),
        filter_summary: filterSummary(stream),
        editable,
        dirty: false,
        offers: offerRows,
        snapshot: cloneOffers(offerRows),
      });

      if (editable && campaign.offer_stream_id == null) {
        await this.campaignModel
          .updateOne({ id: campaign.id }, { offer_stream_id: streamId })
          .exec();
        campaign.offer_stream_id = streamId;
      }
    }

    return this.buildEditorResponse(campaign);
  }

  async addOffer(campaignId: string, keitaroStreamId: number, offerId: number) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    if (!draft.editable) {
      throw new StreamServiceError('This stream is not editable');
    }

    const rows = [...draft.offers].sort(
      (a, b) => a.sort_order - b.sort_order || a.offer_id - b.offer_id,
    );
    const existing = rows.find((r) => r.offer_id === offerId);
    if (existing) {
      if (existing.removed) {
        existing.removed = false;
        existing.pinned = false;
        applyWeights(rows);
        draft.offers = rows;
        draft.dirty = true;
        await draft.save();
        return this.buildEditorResponse(campaign);
      }
      throw new StreamServiceError(`Offer ${offerId} already in stream`);
    }

    let offerName = `Offer ${offerId}`;
    try {
      const remote = await this.keitaro.getOffer(offerId);
      offerName = String(remote.name ?? offerName);
    } catch {
      // keep fallback name
    }

    rows.push({
      offer_id: offerId,
      offer_name: offerName,
      share: 0,
      pinned: false,
      removed: false,
      sort_order: Math.max(-1, ...rows.map((r) => r.sort_order)) + 1,
    });
    applyWeights(rows);
    draft.offers = rows;
    draft.dirty = true;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  async removeOffer(
    campaignId: string,
    keitaroStreamId: number,
    offerId: number,
  ) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    if (!draft.editable) {
      throw new StreamServiceError('This stream is not editable');
    }

    const rows = [...draft.offers];
    const target = rows.find((r) => r.offer_id === offerId);
    if (!target) throw new StreamServiceError('Offer not found in stream');
    target.removed = true;
    target.pinned = false;
    applyWeights(rows);
    draft.offers = rows;
    draft.dirty = true;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  async bringBackOffer(
    campaignId: string,
    keitaroStreamId: number,
    offerId: number,
  ) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    const rows = [...draft.offers];
    const target = rows.find((r) => r.offer_id === offerId);
    if (!target) throw new StreamServiceError('Offer not found in stream');
    target.removed = false;
    applyWeights(rows);
    draft.offers = rows;
    draft.dirty = true;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  async setOfferPin(
    campaignId: string,
    keitaroStreamId: number,
    offerId: number,
    pinned: boolean,
  ) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    const rows = [...draft.offers];
    const target = rows.find((r) => r.offer_id === offerId);
    if (!target) throw new StreamServiceError('Offer not found in stream');
    if (target.removed) {
      throw new StreamServiceError('Cannot pin a removed offer');
    }
    target.pinned = pinned;
    applyWeights(rows);
    draft.offers = rows;
    draft.dirty = true;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  async cancelEdits(campaignId: string, keitaroStreamId: number) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    draft.offers = cloneOffers(draft.snapshot ?? []);
    draft.dirty = false;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  async pushStream(campaignId: string, keitaroStreamId: number) {
    const campaign = await this.getCampaign(campaignId);
    const draft = await this.getDraft(campaignId, keitaroStreamId);
    if (!draft.editable) {
      throw new StreamServiceError('This stream is not editable');
    }

    let rows = [...draft.offers];
    let active = rows.filter((r) => !r.removed);
    if (!active.length) {
      throw new StreamServiceError('Cannot push: no active offers');
    }

    let total = active.reduce((sum, r) => sum + r.share, 0);
    if (total !== 100) {
      const shares: OfferShare[] = active.map((r) => ({
        offer_id: r.offer_id,
        share: r.share,
        pinned: r.pinned,
        removed: false,
      }));
      redistribute(shares);
      const byId = new Map(shares.map((s) => [s.offer_id, s.share]));
      for (const row of active) {
        row.share = byId.get(row.offer_id) ?? row.share;
      }
      total = active.reduce((sum, r) => sum + r.share, 0);
    }

    await this.keitaro.updateStream(keitaroStreamId, {
      offers: active.map((row) => ({
        offer_id: row.offer_id,
        share: row.share,
        state: 'active',
      })),
    });

    rows = rows.filter((r) => !r.removed);
    draft.offers = rows;
    draft.snapshot = cloneOffers(rows);
    draft.dirty = false;
    await draft.save();
    return this.buildEditorResponse(campaign);
  }

  private async getCampaign(campaignId: string): Promise<CampaignDocument> {
    const campaign = await this.campaignModel.findOne({ id: campaignId }).exec();
    if (!campaign) throw new StreamServiceError('Campaign not found');
    return campaign;
  }

  private async getDraft(
    campaignId: string,
    keitaroStreamId: number,
  ): Promise<StreamDraftDocument> {
    const draft = await this.draftModel
      .findOne({ campaign_id: campaignId, keitaro_stream_id: keitaroStreamId })
      .exec();
    if (!draft) {
      throw new StreamServiceError('Stream draft not found; fetch streams first');
    }
    return draft;
  }

  private async buildEditorResponse(campaign: CampaignDocument) {
    const drafts = await this.draftModel
      .find({ campaign_id: campaign.id })
      .sort({ position: 1, keitaro_stream_id: 1 })
      .lean()
      .exec();

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      keitaro_campaign_id: campaign.keitaro_campaign_id,
      keitaro_admin_url: this.keitaroAdminUrl(campaign.keitaro_campaign_id),
      streams: drafts.map((draft) => ({
        keitaro_stream_id: draft.keitaro_stream_id,
        name: draft.name,
        stream_type: draft.stream_type,
        position: draft.position,
        stream_schema: draft.stream_schema,
        filter_summary: draft.filter_summary,
        editable: draft.editable,
        dirty: draft.dirty,
        offers: [...(draft.offers ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order || a.offer_id - b.offer_id)
          .map((row) => ({
            offer_id: row.offer_id,
            offer_name: row.offer_name,
            share: row.share,
            pinned: row.pinned,
            removed: row.removed,
          })),
      })),
    };
  }

  private keitaroAdminUrl(keitaroCampaignId: number): string | null {
    const base = (this.config.get<string>('keitaro.url') ?? '').replace(
      /\/$/,
      '',
    );
    if (!base) return null;
    return `${base}/admin/#!/campaigns/${keitaroCampaignId}`;
  }
}

function applyWeights(rows: StreamOfferDraft[]): void {
  const shares: OfferShare[] = rows.map((row) => ({
    offer_id: row.offer_id,
    share: row.share,
    pinned: row.pinned,
    removed: row.removed,
  }));
  redistribute(shares);
  const byId = new Map(shares.map((s) => [s.offer_id, s]));
  for (const row of rows) {
    const state = byId.get(row.offer_id);
    if (!state) continue;
    row.share = state.share;
    row.pinned = state.pinned;
    row.removed = state.removed;
  }
}

function cloneOffers(rows: StreamOfferDraft[]): StreamOfferDraft[] {
  return rows.map((row) => ({
    offer_id: row.offer_id,
    offer_name: row.offer_name,
    share: row.share,
    pinned: row.pinned,
    removed: row.removed,
    sort_order: row.sort_order,
  }));
}

function filterSummary(stream: JsonDict): string {
  const filters = stream.filters;
  if (!Array.isArray(filters) || !filters.length) return 'None';
  const parts: string[] = [];
  for (const item of filters) {
    if (!item || typeof item !== 'object') continue;
    const dict = item as JsonDict;
    const name = String(dict.name ?? '?');
    const mode = String(dict.mode ?? '?');
    const payload = dict.payload;
    const payloadS = Array.isArray(payload)
      ? payload.map(String).join(',')
      : String(payload ?? '');
    parts.push(`${name}:${mode}:${payloadS}`);
  }
  return parts.join('; ') || 'None';
}

function isEditableStream(stream: JsonDict): boolean {
  const schema = String(stream.schema ?? '').toLowerCase();
  const offers = stream.offers;
  return (
    ['offers', 'landings', 'landings_offers'].includes(schema) ||
    (Array.isArray(offers) && offers.length > 0)
  );
}

function offerNameFromKt(offer: JsonDict): string {
  for (const key of ['name', 'offer_name'] as const) {
    if (offer[key]) return String(offer[key]);
  }
  const nested = offer.offer;
  if (nested && typeof nested === 'object' && (nested as JsonDict).name) {
    return String((nested as JsonDict).name);
  }
  const oid = offer.offer_id ?? offer.id;
  return `Offer ${oid}`;
}

function offerIdFromKt(offer: JsonDict): number | null {
  for (const key of ['offer_id', 'id'] as const) {
    if (offer[key] != null) {
      const n = Number(offer[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
