import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * One document per keyword_search API call — used to enforce the
 * 2,200 queries / rolling 24h per-user API limit. TTL-expires after 2 days.
 */
@Schema({ timestamps: true })
export class SearchQueryLog {
  @Prop({ required: true })
  query: string;

  @Prop({ default: Date.now, expires: 2 * 24 * 3600 })
  createdAt: Date;
}

export type SearchQueryLogDocument = HydratedDocument<SearchQueryLog>;
export const SearchQueryLogSchema = SchemaFactory.createForClass(SearchQueryLog);
