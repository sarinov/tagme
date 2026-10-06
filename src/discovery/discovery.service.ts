import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CronJob } from 'cron';
import { ThreadsApiService, ThreadsPost } from '../threads/threads-api.service';
import { THREADS_MENTION_EVENT } from '../threads/threads-webhook.controller';
import { Candidate, CandidateSource, CandidateStatus } from './schemas/candidate.schema';
import { SearchQueryLog } from './schemas/search-query-log.schema';

/**
 * Discovery agent: periodically runs keyword searches (RU/KZ travel queries)
 * and ingests mention webhooks into the candidate queue.
 * Respects the keyword-search query budget (rolling 24h window).
 */
@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly threadsApi: ThreadsApiService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectModel(Candidate.name) private readonly candidateModel: Model<Candidate>,
    @InjectModel(SearchQueryLog.name) private readonly queryLogModel: Model<SearchQueryLog>,
  ) {}

  onModuleInit() {
    const cronExpr = this.config.get<string>('agent.discoveryCron') ?? '0 */4 * * *';
    const job = new CronJob(cronExpr, () => void this.runDiscovery());
    this.schedulerRegistry.addCronJob('discovery', job);
    job.start();
    this.logger.log(`Discovery cron scheduled: ${cronExpr}`);
  }

  /** Remaining searches in the rolling 24-hour window (API limit: 2,200/24h per user, across apps). */
  async remainingSearchBudget(): Promise<number> {
    const budget = this.config.get<number>('agent.searchBudget24h') ?? 2000;
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const used = await this.queryLogModel.countDocuments({ createdAt: { $gte: since } });
    return Math.max(0, budget - used);
  }

  async runDiscovery(): Promise<void> {
    const keywords = this.config.get<string[]>('agent.keywords') ?? [];
    if (keywords.length === 0) {
      this.logger.warn('No DISCOVERY_KEYWORDS configured, skipping');
      return;
    }
    let budget = await this.remainingSearchBudget();
    this.logger.log(`Running discovery, search budget left: ${budget}`);

    for (const keyword of keywords) {
      if (budget <= 0) {
        this.logger.warn('Search budget exhausted for the 24h window, stopping');
        break;
      }
      try {
        await this.queryLogModel.create({ query: keyword });
        budget--;
        const posts = await this.threadsApi.keywordSearch(keyword);
        const inserted = await this.ingestPosts(posts, CandidateSource.KEYWORD_SEARCH, keyword);
        this.logger.log(`"${keyword}": ${posts.length} results, ${inserted} new candidates`);
      } catch (err) {
        this.logger.error(`Search failed for "${keyword}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Polls the mentions endpoint (threads_manage_mentions). Webhooks cover this too,
   * but they need a public HTTPS endpoint — polling makes mentions work anywhere.
   * Mentions cost nothing against the keyword-search budget.
   */
  @Cron('*/15 * * * *')
  async fetchMentions(): Promise<number> {
    try {
      const posts = await this.threadsApi.getMentions();
      const inserted = await this.ingestPosts(posts, CandidateSource.MENTION);
      this.logger.log(`Mentions: ${posts.length} fetched, ${inserted} new candidates`);
      return inserted;
    } catch (err) {
      this.logger.error(`Fetching mentions failed: ${(err as Error).message}`);
      return 0;
    }
  }

  @OnEvent(THREADS_MENTION_EVENT)
  async onMention(value: any): Promise<void> {
    const post: ThreadsPost = {
      id: value?.media_id ?? value?.id,
      text: value?.text,
      username: value?.username,
      permalink: value?.permalink,
      timestamp: value?.timestamp,
    };
    if (!post.id) return;
    const inserted = await this.ingestPosts([post], CandidateSource.MENTION);
    if (inserted > 0) this.logger.log(`Ingested mention ${post.id}`);
  }

  /** Dedupe by threadsPostId; returns number of newly inserted candidates. */
  private async ingestPosts(
    posts: ThreadsPost[],
    source: CandidateSource,
    matchedKeyword?: string,
  ): Promise<number> {
    let inserted = 0;
    for (const post of posts) {
      try {
        await this.candidateModel.create({
          threadsPostId: post.id,
          source,
          matchedKeyword,
          authorUsername: post.username,
          text: post.text,
          permalink: post.permalink,
          postedAt: post.timestamp ? new Date(post.timestamp) : undefined,
          status: CandidateStatus.NEW,
        });
        inserted++;
      } catch (err: any) {
        if (err?.code !== 11000) throw err; // ignore duplicate key
      }
    }
    return inserted;
  }
}
