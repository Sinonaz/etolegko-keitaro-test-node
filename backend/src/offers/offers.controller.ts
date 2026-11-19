import { Controller, Get, Query } from '@nestjs/common';
import { toHttpException } from '../common/keitaro-http';
import { KeitaroClient } from '../keitaro/keitaro.client';

@Controller('offers')
export class OffersController {
  constructor(private readonly keitaro: KeitaroClient) {}

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('limit') limitRaw?: string,
  ) {
    const query = (q ?? '').trim();
    if (!query) {
      return [];
    }
    const limit = Math.min(
      Math.max(Number(limitRaw ?? 15) || 15, 1),
      50,
    );

    try {
      const offers = await this.keitaro.searchOffers(query, limit);
      const result: { id: number; name: string }[] = [];
      for (const offer of offers) {
        try {
          result.push({
            id: Number(offer.id),
            name: String(offer.name ?? `Offer ${offer.id}`),
          });
        } catch {
          continue;
        }
      }
      return result;
    } catch (err) {
      throw toHttpException(err);
    }
  }
}
