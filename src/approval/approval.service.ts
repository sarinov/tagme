import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidate, CandidateStatus } from '../discovery/schemas/candidate.schema';
import { ThreadsApiService } from '../threads/threads-api.service';
import { TelegramService } from './telegram.service';

/**
 * Human-in-the-loop approval: sends drafts to Telegram, handles
 * approve / edit / reject, publishes approved replies with a daily cap
 * (target 5-15 quality replies/day — spam flags are the main risk).
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    private readonly threadsApi: ThreadsApiService,
    @InjectModel(Candidate.name) private readonly candidateModel: Model<Candidate>,
  ) {}

  async requestApproval(candidateId: string): Promise<void> {
    const candidate = await this.candidateModel.findById(candidateId);
    if (!candidate?.draftReply) return;
    const messageId = await this.telegram.sendApprovalRequest(candidateId, {
      author: candidate.authorUsername ?? 'unknown',
      postText: candidate.text ?? '',
      permalink: candidate.permalink,
      score: candidate.relevanceScore ?? 0,
      reason: candidate.relevanceReason ?? '',
      draft: candidate.draftReply,
    });
    if (messageId) {
      await this.candidateModel.updateOne({ _id: candidateId }, { telegramMessageId: messageId });
    }
  }

  async repliesPublishedToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.candidateModel.countDocuments({
      status: CandidateStatus.REPLIED,
      updatedAt: { $gte: startOfDay },
    });
  }

  async approve(candidateId: string, editedText?: string): Promise<string> {
    const candidate = await this.candidateModel.findById(candidateId);
    if (!candidate) return 'Кандидат не найден';
    if (candidate.status === CandidateStatus.REPLIED) return 'Уже опубликовано';

    const maxPerDay = this.config.get<number>('agent.maxRepliesPerDay') ?? 15;
    const publishedToday = await this.repliesPublishedToday();
    if (publishedToday >= maxPerDay) {
      return `Дневной лимит ответов (${maxPerDay}) исчерпан. Кандидат остаётся в очереди.`;
    }

    const replyText = editedText ?? candidate.draftReply;
    if (!replyText) return 'Нет текста ответа';

    try {
      const replyId = await this.threadsApi.publishReply(candidate.threadsPostId, replyText);
      await this.candidateModel.updateOne(
        { _id: candidateId },
        { status: CandidateStatus.REPLIED, publishedReplyId: replyId, draftReply: replyText },
      );
      this.logger.log(`Reply published for ${candidate.threadsPostId} (${publishedToday + 1}/${maxPerDay} today)`);
      return `✅ Опубликовано (${publishedToday + 1}/${maxPerDay} сегодня)`;
    } catch (err) {
      await this.candidateModel.updateOne({ _id: candidateId }, { status: CandidateStatus.FAILED });
      this.logger.error(`Publish failed: ${(err as Error).message}`);
      return `❌ Ошибка публикации: ${(err as Error).message}`;
    }
  }

  async reject(candidateId: string): Promise<string> {
    await this.candidateModel.updateOne(
      { _id: candidateId },
      { status: CandidateStatus.REJECTED },
    );
    return '🚫 Отклонено';
  }

  async updateDraft(candidateId: string, newDraft: string): Promise<void> {
    await this.candidateModel.updateOne({ _id: candidateId }, { draftReply: newDraft });
  }

  async getCandidate(candidateId: string) {
    return this.candidateModel.findById(candidateId);
  }
}
