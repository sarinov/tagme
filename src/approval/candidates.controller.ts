import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Candidate, CandidateStatus } from '../discovery/schemas/candidate.schema';
import { ApprovalService } from './approval.service';

/** REST alternative to the Telegram approval flow, used by the dashboard UI. */
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly approval: ApprovalService,
    @InjectModel(Candidate.name) private readonly candidateModel: Model<Candidate>,
  ) {}

  @Get()
  list(@Query('status') status?: string, @Query('source') source?: string) {
    const filter: Record<string, unknown> = {};
    if (status && status !== 'ALL') filter.status = status as CandidateStatus;
    if (source) filter.source = source;
    return this.candidateModel.find(filter).sort({ updatedAt: -1 }).limit(100);
  }

  @Get('counts')
  async counts() {
    const rows = await this.candidateModel.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: { text?: string }) {
    const result = await this.approval.approve(id, body?.text?.trim() || undefined);
    return { result };
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    const result = await this.approval.reject(id);
    return { result };
  }
}
