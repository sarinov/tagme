import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Stores the current long-lived Threads token (60d) so refreshes survive restarts. */
@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ required: true, unique: true })
  provider: string; // 'threads'

  @Prop({ required: true })
  accessToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export type ApiTokenDocument = HydratedDocument<ApiToken>;
export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);
