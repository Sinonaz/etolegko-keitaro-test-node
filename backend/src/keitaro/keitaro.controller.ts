import { Controller, Get } from '@nestjs/common';
import { KeitaroClient } from './keitaro.client';
import {
  KeitaroAPIError,
  KeitaroNotConfiguredError,
} from './keitaro.exceptions';

@Controller('keitaro')
export class KeitaroController {
  constructor(private readonly client: KeitaroClient) {}

  @Get('status')
  async status() {
    if (!this.client.isConfigured) {
      return {
        configured: false,
        reachable: null,
        keitaro_url: null,
        error: 'KEITARO_URL and KEITARO_API_KEY are required',
      };
    }

    try {
      await this.client.ping();
      return {
        configured: true,
        reachable: true,
        keitaro_url: this.client.baseUrl,
        error: null,
      };
    } catch (err) {
      const message =
        err instanceof KeitaroNotConfiguredError ||
        err instanceof KeitaroAPIError ||
        err instanceof Error
          ? err.message
          : String(err);
      return {
        configured: true,
        reachable: false,
        keitaro_url: this.client.baseUrl,
        error: message,
      };
    }
  }
}
