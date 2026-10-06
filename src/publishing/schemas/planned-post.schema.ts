import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum PlannedPostStatus {
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

/** A pre-planned Tagme content post, auto-published without approval. */
@Schema({ timestamps: true })
export class PlannedPost {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true, index: true })
  scheduledAt: Date;

  @Prop({ required: true, enum: PlannedPostStatus, default: PlannedPostStatus.SCHEDULED, index: true })
  status: PlannedPostStatus;

  @Prop()
  publishedMediaId?: string;

  @Prop()
  error?: string;
}

export type PlannedPostDocument = HydratedDocument<PlannedPost>;
export const PlannedPostSchema = SchemaFactory.createForClass(PlannedPost);
