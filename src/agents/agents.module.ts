import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ApprovalModule } from '../approval/approval.module';
import { AgentPipelineService } from './agent-pipeline.service';

@Module({
  imports: [DiscoveryModule, ApprovalModule],
  providers: [AgentPipelineService],
  exports: [AgentPipelineService],
})
export class AgentsModule {}
