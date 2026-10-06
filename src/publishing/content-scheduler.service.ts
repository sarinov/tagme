import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ThreadsApiService } from '../threads/threads-api.service';
import { PlannedPost, PlannedPostStatus } from './schemas/planned-post.schema';

/**
 * Content scheduler: every 5 minutes publishes due planned posts.
 * Fully automated — no human approval needed (per handoff decision).
 */
@Injectable()
export class ContentSchedulerService {
  private readonly logger = new Logger(ContentSchedulerService.name);

  constructor(
    private readonly threadsApi: ThreadsApiService,
    @InjectModel(PlannedPost.name) private readonly plannedPostModel: Model<PlannedPost>,
  ) {}

  @Cron('*/5 * * * *')
  async publishDuePosts(): Promise<void> {
    const due = await this.plannedPostModel
      .find({ status: PlannedPostStatus.SCHEDULED, scheduledAt: { $lte: new Date() } })
      .sort({ scheduledAt: 1 });

    for (const post of due) {
      try {
        const mediaId = await this.threadsApi.publishTextPost(post.text);
        await this.plannedPostModel.updateOne(
          { _id: post._id },
          { status: PlannedPostStatus.PUBLISHED, publishedMediaId: mediaId },
        );
        this.logger.log(`Published planned post ${post._id} -> media ${mediaId}`);
      } catch (err) {
        await this.plannedPostModel.updateOne(
          { _id: post._id },
          { status: PlannedPostStatus.FAILED, error: (err as Error).message },
        );
        this.logger.error(`Planned post ${post._id} failed: ${(err as Error).message}`);
      }
    }
  }
}
