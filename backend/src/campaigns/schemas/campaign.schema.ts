import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CampaignDocument = HydratedDocument<Campaign>;

@Schema({ collection: 'campaigns', timestamps: { createdAt: true, updatedAt: false } })
export class Campaign {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  geo!: string;

  @Prop({ required: true })
  offer_id!: number;

  @Prop({ required: true, unique: true })
  keitaro_campaign_id!: number;

  @Prop({ required: true })
  keitaro_alias!: string;

  @Prop({ type: Number, default: null })
  geo_stream_id!: number | null;

  @Prop({ type: Number, default: null })
  offer_stream_id!: number | null;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ id: 1 }, { unique: true });
