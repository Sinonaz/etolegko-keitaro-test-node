import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { KeitaroClient } from '../keitaro/keitaro.client';
import {
  KeitaroAPIError,
  KeitaroError,
} from '../keitaro/keitaro.exceptions';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';

type JsonDict = Record<string, unknown>;

export class CampaignServiceError extends KeitaroError {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignServiceError';
  }
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    private readonly keitaro: KeitaroClient,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<Record<string, unknown>[]> {
    const rows = await this.campaignModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows.map((row) => this.toResponse(row));
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const row = await this.campaignModel.findOne({ id }).lean().exec();
    if (!row) {
      throw new CampaignServiceError('Not found');
    }
    return this.toResponse(row);
  }

  async create(dto: CreateCampaignDto): Promise<Record<string, unknown>> {
    const { domainId, groupId, sourceId } = await this.resolveDefaults();
    const alias = makeAlias(dto.name);

    try {
      await this.keitaro.getOffer(dto.offer_id);
    } catch (err) {
      if (err instanceof KeitaroAPIError) {
        throw new CampaignServiceError(
          `Offer ${dto.offer_id} not found in Keitaro`,
        );
      }
      throw err;
    }

    const created = await this.keitaro.createCampaign({
      name: dto.name,
      alias,
      type: 'position',
      state: 'active',
      domain_id: domainId,
      group_id: String(groupId),
      traffic_source_id: sourceId,
      cost_type: 'CPC',
      cost_value: 0,
      cost_auto: true,
    });

    const campaignId = Number(created.id);
    const whitePage =
      this.config.get<string>('keitaro.whitePageUrl') ?? 'https://google.com';

    const geoStream = await this.keitaro.createStream({
      campaign_id: campaignId,
      type: 'regular',
      name: `Geo ${dto.geo} → Google`,
      position: 1,
      schema: 'action',
      action_type: 'http',
      action_payload: whitePage,
      collect_clicks: true,
      filters: [
        {
          name: 'country',
          mode: 'accept',
          payload: [dto.geo],
        },
      ],
    });

    const offerStream = await this.keitaro.createStream({
      campaign_id: campaignId,
      type: 'default',
      name: 'Default offers',
      position: 2,
      schema: 'landings',
      action_type: 'http',
      action_payload: '',
      collect_clicks: true,
      landings: [],
      offers: [
        {
          offer_id: dto.offer_id,
          share: 100,
          state: 'active',
        },
      ],
    });

    const id = randomUUID();
    const doc = await this.campaignModel.create({
      id,
      name: dto.name,
      geo: dto.geo,
      offer_id: dto.offer_id,
      keitaro_campaign_id: campaignId,
      keitaro_alias: String(created.alias ?? alias),
      geo_stream_id:
        geoStream.id != null ? Number(geoStream.id) : null,
      offer_stream_id:
        offerStream.id != null ? Number(offerStream.id) : null,
    });

    return this.toResponse(doc.toObject());
  }

  private async resolveDefaults(): Promise<{
    domainId: number;
    groupId: number | string;
    sourceId: number;
  }> {
    let domainId = this.config.get<number | undefined>('keitaro.domainId');
    if (domainId === undefined) {
      const domain = findDomain(
        await this.keitaro.listDomains(),
        this.config.get<string>('keitaro.domainName') ?? '',
      );
      if (!domain || domain.id == null) {
        throw new CampaignServiceError(
          'No Keitaro domain found; set KEITARO_DOMAIN_ID or KEITARO_DOMAIN_NAME',
        );
      }
      domainId = Number(domain.id);
    }

    let groupId: number | string | undefined =
      this.config.get<number | undefined>('keitaro.groupId');
    if (groupId === undefined) {
      const groupName = this.config.get<string>('keitaro.groupName') ?? 'FORTESTS';
      const group = findByName(
        await this.keitaro.listGroups('campaigns'),
        groupName,
      );
      if (!group || group.id == null) {
        throw new CampaignServiceError(
          `Campaign group '${groupName}' not found; set KEITARO_GROUP_ID`,
        );
      }
      groupId = group.id as number | string;
    }

    let sourceId = this.config.get<number | undefined>('keitaro.sourceId');
    if (sourceId === undefined) {
      const source = findByName(
        await this.keitaro.listTrafficSources(),
        this.config.get<string>('keitaro.sourceName') ?? 'FORTESTS',
      );
      sourceId =
        source && source.id != null ? Number(source.id) : 0;
    }

    return { domainId, groupId, sourceId };
  }

  private toResponse(row: {
    id: string;
    name: string;
    geo: string;
    offer_id: number;
    keitaro_campaign_id: number;
    keitaro_alias: string;
    geo_stream_id?: number | null;
    offer_stream_id?: number | null;
    createdAt?: Date;
  }): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      geo: row.geo,
      offer_id: row.offer_id,
      keitaro_campaign_id: row.keitaro_campaign_id,
      keitaro_alias: row.keitaro_alias,
      geo_stream_id: row.geo_stream_id ?? null,
      offer_stream_id: row.offer_stream_id ?? null,
      created_at: row.createdAt ?? new Date(),
    };
  }
}

function makeAlias(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'campaign';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

function findByName(items: JsonDict[], name: string): JsonDict | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  for (const item of items) {
    if (String(item.name ?? '').trim().toLowerCase() === target) {
      return item;
    }
  }
  return null;
}

function findDomain(items: JsonDict[], nameHint: string): JsonDict | null {
  const hint = nameHint.trim().toLowerCase();
  if (hint) {
    for (const item of items) {
      if (String(item.name ?? '').toLowerCase().includes(hint)) {
        return item;
      }
    }
  }
  for (const item of items) {
    const state = String(item.state ?? 'active').toLowerCase();
    if (state !== 'deleted') return item;
  }
  return items[0] ?? null;
}
