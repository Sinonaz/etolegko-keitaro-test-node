import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { StreamDraft, StreamDraftSchema } from './schemas/stream-draft.schema';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: StreamDraft.name, schema: StreamDraftSchema },
    ]),
  ],
  controllers: [StreamsController],
  providers: [StreamsService],
})
export class StreamsModule {}
