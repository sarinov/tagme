import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThreadsModule } from '../threads/threads.module';
import { PlannedPost, PlannedPostSchema } from './schemas/planned-post.schema';
import { ContentSchedulerService } from './content-scheduler.service';
import { PlannedPostsController } from './planned-posts.controller';

@Module({
  imports: [
    ThreadsModule,
    MongooseModule.forFeature([{ name: PlannedPost.name, schema: PlannedPostSchema }]),
  ],
  controllers: [PlannedPostsController],
  providers: [ContentSchedulerService],
})
export class PublishingModule {}
