import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThreadsModule } from '../threads/threads.module';
import { Candidate, CandidateSchema } from '../discovery/schemas/candidate.schema';
import { ApprovalService } from './approval.service';
import { TelegramService } from './telegram.service';
import { CandidatesController } from './candidates.controller';

@Module({
  imports: [
    ThreadsModule,
    MongooseModule.forFeature([{ name: Candidate.name, schema: CandidateSchema }]),
  ],
  controllers: [CandidatesController],
  providers: [ApprovalService, TelegramService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
