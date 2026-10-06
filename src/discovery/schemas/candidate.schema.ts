import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum CandidateSource {
  KEYWORD_SEARCH = 'KEYWORD_SEARCH',
  MENTION = 'MENTION',
}

export enum CandidateStatus {
  NEW = 'NEW', // discovered, not yet scored
  RELEVANT = 'RELEVANT', // passed relevance filter, draft pending
  IRRELEVANT = 'IRRELEVANT', // below threshold, terminal
  PENDING_APPROVAL = 'PENDING_APPROVAL', // draft sent to Telegram
  APPROVED = 'APPROVED', // approved, queued for publish
  REJECTED = 'REJECTED', // human rejected, terminal
  REPLIED = 'REPLIED', // reply published, terminal
  FAILED = 'FAILED', // publish error, needs attention
}

/** A discovered Threads post that we might reply to. */
@Schema({ timestamps: true })
export class Candidate {
  @Prop({ required: true, unique: true })
  threadsPostId: string;

  @Prop({ required: true, enum: CandidateSource })
  source: CandidateSource;

  @Prop()
  matchedKeyword?: string;

  @Prop()
  authorUsername?: string;

  @Prop()
  text?: string;

  @Prop()
  permalink?: string;

  @Prop()
  postedAt?: Date;

  @Prop({ required: true, enum: CandidateStatus, default: CandidateStatus.NEW, index: true })
  status: CandidateStatus;

  @Prop()
  relevanceScore?: number;

  @Prop()
  relevanceReason?: string;

  @Prop()
  draftReply?: string;

  @Prop()
  publishedReplyId?: string;

  @Prop()
  telegramMessageId?: number;
}

export type CandidateDocument = HydratedDocument<Candidate>;
export const CandidateSchema = SchemaFactory.createForClass(Candidate);
