import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { AgentsModule } from '../agents/agents.module';
import { ThreadsModule } from '../threads/threads.module';
import { ApprovalModule } from '../approval/approval.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [DiscoveryModule, AgentsModule, ThreadsModule, ApprovalModule],
  controllers: [AdminController],
})
export class AdminModule {}
