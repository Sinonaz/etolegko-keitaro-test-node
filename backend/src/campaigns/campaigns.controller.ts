import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { toHttpException } from '../common/keitaro-http';
import { CampaignsService, CampaignServiceError } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateCampaignDto) {
    try {
      return await this.campaigns.create(body);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Get()
  async list() {
    return this.campaigns.list();
  }

  @Get(':campaignId')
  async get(@Param('campaignId') campaignId: string) {
    try {
      return await this.campaigns.get(campaignId);
    } catch (err) {
      if (err instanceof CampaignServiceError && err.message === 'Not found') {
        throw new NotFoundException({ detail: 'Not found' });
      }
      throw toHttpException(err);
    }
  }
}
