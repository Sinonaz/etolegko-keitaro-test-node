import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { toHttpException } from '../common/keitaro-http';
import { AddOfferDto } from './dto/add-offer.dto';
import { StreamsService } from './streams.service';

@Controller('campaigns/:campaignId/streams')
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

  @Get()
  async read(@Param('campaignId') campaignId: string) {
    try {
      return await this.streams.getEditor(campaignId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('fetch')
  async fetch(@Param('campaignId') campaignId: string) {
    try {
      return await this.streams.fetchStreams(campaignId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/offers')
  async addOffer(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
    @Body() body: AddOfferDto,
  ) {
    try {
      return await this.streams.addOffer(campaignId, streamId, body.offer_id);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/offers/:offerId/remove')
  async removeOffer(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    try {
      return await this.streams.removeOffer(campaignId, streamId, offerId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/offers/:offerId/bring-back')
  async bringBack(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    try {
      return await this.streams.bringBackOffer(campaignId, streamId, offerId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/offers/:offerId/pin')
  async pin(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    try {
      return await this.streams.setOfferPin(
        campaignId,
        streamId,
        offerId,
        true,
      );
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/offers/:offerId/unpin')
  async unpin(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
    @Param('offerId', ParseIntPipe) offerId: number,
  ) {
    try {
      return await this.streams.setOfferPin(
        campaignId,
        streamId,
        offerId,
        false,
      );
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/push')
  async push(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
  ) {
    try {
      return await this.streams.pushStream(campaignId, streamId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post(':streamId/cancel')
  async cancel(
    @Param('campaignId') campaignId: string,
    @Param('streamId', ParseIntPipe) streamId: number,
  ) {
    try {
      return await this.streams.cancelEdits(campaignId, streamId);
    } catch (err) {
      throw toHttpException(err);
    }
  }
}
