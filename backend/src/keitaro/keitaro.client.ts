import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import {
  KeitaroAPIError,
  KeitaroNotConfiguredError,
} from './keitaro.exceptions';

type JsonDict = Record<string, unknown>;

@Injectable()
export class KeitaroClient {
  private http: AxiosInstance | null = null;

  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    return (this.config.get<string>('keitaro.url') ?? '').replace(/\/$/, '');
  }

  get apiKey(): string {
    return this.config.get<string>('keitaro.apiKey') ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new KeitaroNotConfiguredError(
        'Set KEITARO_URL and KEITARO_API_KEY in backend/.env',
      );
    }
  }

  private getHttp(): AxiosInstance {
    this.ensureConfigured();
    if (!this.http) {
      this.http = axios.create({
        baseURL: `${this.baseUrl}/admin_api/v1`,
        headers: {
          'Api-Key': this.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      });
    }
    return this.http;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    options?: { params?: Record<string, unknown>; data?: unknown },
  ): Promise<T> {
    const http = this.getHttp();
    try {
      const response = await http.request<T>({
        method,
        url: path,
        params: options?.params,
        data: options?.data,
      });
      return response.data;
    } catch (err) {
      if (isAxiosError(err)) {
        if (!err.response) {
          throw new KeitaroAPIError(
            `Keitaro ${method} ${path} unreachable: ${err.message}`,
            null,
            { url: this.baseUrl },
          );
        }
        throw new KeitaroAPIError(
          `Keitaro ${method} ${path} failed with HTTP ${err.response.status}`,
          err.response.status,
          err.response.data,
        );
      }
      throw err;
    }
  }

  async ping(): Promise<boolean> {
    await this.listCampaigns({ limit: 1 });
    return true;
  }

  async listCampaigns(opts?: {
    offset?: number;
    limit?: number;
  }): Promise<JsonDict[]> {
    const params: Record<string, unknown> = {};
    if (opts?.offset !== undefined) params.offset = opts.offset;
    if (opts?.limit !== undefined) params.limit = opts.limit;
    return asList(
      await this.request('GET', '/campaigns', {
        params: Object.keys(params).length ? params : undefined,
      }),
    );
  }

  async getCampaign(campaignId: number): Promise<JsonDict> {
    return asDict(await this.request('GET', `/campaigns/${campaignId}`));
  }

  async createCampaign(payload: JsonDict): Promise<JsonDict> {
    return asDict(await this.request('POST', '/campaigns', { data: payload }));
  }

  async updateCampaign(
    campaignId: number,
    payload: JsonDict,
  ): Promise<JsonDict> {
    return asDict(
      await this.request('PUT', `/campaigns/${campaignId}`, { data: payload }),
    );
  }

  async listCampaignStreams(campaignId: number): Promise<JsonDict[]> {
    return asList(
      await this.request('GET', `/campaigns/${campaignId}/streams`),
    );
  }

  async getStream(streamId: number): Promise<JsonDict> {
    return asDict(await this.request('GET', `/streams/${streamId}`));
  }

  async createStream(payload: JsonDict): Promise<JsonDict> {
    return asDict(await this.request('POST', '/streams', { data: payload }));
  }

  async updateStream(streamId: number, payload: JsonDict): Promise<JsonDict> {
    return asDict(
      await this.request('PUT', `/streams/${streamId}`, { data: payload }),
    );
  }

  async listOffers(): Promise<JsonDict[]> {
    return asList(await this.request('GET', '/offers'));
  }

  async getOffer(offerId: number): Promise<JsonDict> {
    return asDict(await this.request('GET', `/offers/${offerId}`));
  }

  async searchOffers(query: string, limit = 20): Promise<JsonDict[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched: JsonDict[] = [];
    for (const offer of await this.listOffers()) {
      const haystack = ['id', 'name', 'group', 'notes', 'offer_type']
        .map((key) => String(offer[key] ?? ''))
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) {
        matched.push(offer);
      }
      if (matched.length >= limit) break;
    }
    return matched;
  }

  async listDomains(): Promise<JsonDict[]> {
    return asList(await this.request('GET', '/domains'));
  }

  async listGroups(groupType = 'campaigns'): Promise<JsonDict[]> {
    return asList(
      await this.request('GET', '/groups', { params: { type: groupType } }),
    );
  }

  async listTrafficSources(): Promise<JsonDict[]> {
    return asList(await this.request('GET', '/traffic_sources'));
  }
}

function asList(data: unknown): JsonDict[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as JsonDict[];
  throw new KeitaroAPIError('Expected a JSON array from Keitaro', null, data);
}

function asDict(data: unknown): JsonDict {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as JsonDict;
  }
  throw new KeitaroAPIError('Expected a JSON object from Keitaro', null, data);
}
