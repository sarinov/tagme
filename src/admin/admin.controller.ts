import { Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '../discovery/discovery.service';
import { AgentPipelineService } from '../agents/agent-pipeline.service';
import { ThreadsApiService } from '../threads/threads-api.service';
import { ApprovalService } from '../approval/approval.service';

/**
 * Manual triggers for testing/demo — the same jobs normally run on cron
 * (discovery every 4h, pipeline every 10min).
 *
 *   curl -X POST localhost:3000/admin/discover       # keyword search now
 *   curl -X POST localhost:3000/admin/process-queue  # score + draft NEW candidates now
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly pipeline: AgentPipelineService,
    private readonly threadsApi: ThreadsApiService,
    private readonly approval: ApprovalService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  async status() {
    let profile: unknown = null;
    try {
      profile = await this.threadsApi.getProfile();
    } catch {
      // token missing/expired — dashboard shows a warning instead
    }
    return {
      profile,
      searchBudgetLeft: await this.discovery.remainingSearchBudget(),
      repliesToday: await this.approval.repliesPublishedToday(),
      maxRepliesPerDay: this.config.get<number>('agent.maxRepliesPerDay') ?? 15,
      keywords: this.config.get<string[]>('agent.keywords') ?? [],
    };
  }

  /** Fire-and-forget: discovery over many keywords takes minutes; the UI polls for results. */
  @Post('discover')
  async discover() {
    void this.discovery.runDiscovery();
    return { started: true, budgetLeft: await this.discovery.remainingSearchBudget() };
  }

  /** Pull posts that @-mention our account (threads_manage_mentions). */
  @Post('fetch-mentions')
  async fetchMentions() {
    const inserted = await this.discovery.fetchMentions();
    return { inserted };
  }

  @Post('process-queue')
  processQueue() {
    void this.pipeline.processQueue();
    return { started: true };
  }

  /** Live read of posts that @-mention the account (threads_manage_mentions). */
  @Get('mentions')
  async mentions() {
    try {
      return { mentions: await this.threadsApi.getMentions() };
    } catch (e) {
      return { mentions: [], error: (e as Error).message };
    }
  }
}
