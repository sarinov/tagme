import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThreadsModule } from '../threads/threads.module';
import { Candidate, CandidateSchema } from './schemas/candidate.schema';
import { SearchQueryLog, SearchQueryLogSchema } from './schemas/search-query-log.schema';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [
    ThreadsModule,
    MongooseModule.forFeature([
      { name: Candidate.name, schema: CandidateSchema },
      { name: SearchQueryLog.name, schema: SearchQueryLogSchema },
    ]),
  ],
  providers: [DiscoveryService],
  exports: [DiscoveryService, MongooseModule],
})
export class DiscoveryModule {}
