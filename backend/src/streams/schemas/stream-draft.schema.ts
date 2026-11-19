import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class StreamOfferDraft {
  @Prop({ required: true })
  offer_id!: number;

  @Prop({ default: '' })
  offer_name!: string;

  @Prop({ default: 0 })
  share!: number;

  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ default: false })
  removed!: boolean;

  @Prop({ default: 0 })
  sort_order!: number;
}

export const StreamOfferDraftSchema =
  SchemaFactory.createForClass(StreamOfferDraft);

export type StreamDraftDocument = HydratedDocument<StreamDraft>;

@Schema({
  collection: 'stream_drafts',
  timestamps: { createdAt: false, updatedAt: true },
})
export class StreamDraft {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true, index: true })
  campaign_id!: string;

  @Prop({ required: true })
  keitaro_stream_id!: number;

  @Prop({ default: '' })
  name!: string;

  @Prop({ default: 'regular' })
  stream_type!: string;

  @Prop({ default: 0 })
  position!: number;

  @Prop({ default: '' })
  stream_schema!: string;

  @Prop({ default: 'None' })
  filter_summary!: string;

  @Prop({ default: false })
  editable!: boolean;

  @Prop({ default: false })
  dirty!: boolean;

  @Prop({ type: [StreamOfferDraftSchema], default: [] })
  offers!: StreamOfferDraft[];

  @Prop({ type: [Object], default: [] })
  snapshot!: StreamOfferDraft[];
}

export const StreamDraftSchema = SchemaFactory.createForClass(StreamDraft);

StreamDraftSchema.index(
  { campaign_id: 1, keitaro_stream_id: 1 },
  { unique: true },
);
