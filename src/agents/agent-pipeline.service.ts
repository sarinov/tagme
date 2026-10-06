import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidate, CandidateStatus } from '../discovery/schemas/candidate.schema';
import { buildReplyPipeline } from './reply-pipeline.graph';
import { ApprovalService } from '../approval/approval.service';

/**
 * Drains the candidate queue: NEW candidates run through the LangGraph
 * pipeline (relevance filter -> reply drafter), relevant ones get a draft
 * and are pushed to Telegram for human approval.
 */
@Injectable()
export class AgentPipelineService {
  private readonly logger = new Logger(AgentPipelineService.name);
  private readonly pipeline;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly approval: ApprovalService,
    @InjectModel(Candidate.name) private readonly candidateModel: Model<Candidate>,
  ) {
    this.pipeline = buildReplyPipeline({
      googleApiKey: this.config.get<string>('llm.googleApiKey') ?? '',
      model: this.config.get<string>('llm.model') ?? 'gemini-3.1-flash-lite',
      relevanceThreshold: this.config.get<number>('agent.relevanceThreshold') ?? 0.7,
    });
  }

  /** Every 10 minutes, process up to 20 NEW candidates. */
  @Cron('*/10 * * * *')
  async processQueue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const batch = await this.candidateModel
        .find({ status: CandidateStatus.NEW })
        .sort({ createdAt: 1 })
        .limit(20);

      for (const candidate of batch) {
        await this.processCandidate(candidate);
      }
    } finally {
      this.running = false;
    }
  }

  private async processCandidate(candidate: Candidate & { _id: any }): Promise<void> {
    if (!candidate.text?.trim()) {
      await this.candidateModel.updateOne(
        { _id: candidate._id },
        { status: CandidateStatus.IRRELEVANT, relevanceReason: 'empty text' },
      );
      return;
    }
    try {
      const result = await this.pipeline.invoke({
        candidate: {
          threadsPostId: candidate.threadsPostId,
          text: candidate.text,
          authorUsername: candidate.authorUsername,
          matchedKeyword: candidate.matchedKeyword,
          source: candidate.source,
        },
      });

      if (!result.isRelevant || !result.draftReply) {
        await this.candidateModel.updateOne(
          { _id: candidate._id },
          {
            status: CandidateStatus.IRRELEVANT,
            relevanceScore: result.relevanceScore,
            relevanceReason: result.relevanceReason,
          },
        );
        return;
      }

      await this.candidateModel.updateOne(
        { _id: candidate._id },
        {
          status: CandidateStatus.PENDING_APPROVAL,
          relevanceScore: result.relevanceScore,
          relevanceReason: result.relevanceReason,
          draftReply: result.draftReply,
        },
      );
      await this.approval.requestApproval(String(candidate._id));
      this.logger.log(
        `Candidate ${candidate.threadsPostId} scored ${result.relevanceScore}, sent for approval`,
      );
    } catch (err) {
      this.logger.error(
        `Pipeline failed for ${candidate.threadsPostId}: ${(err as Error).message}`,
      );
    }
  }
}
