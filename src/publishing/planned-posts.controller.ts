import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlannedPost, PlannedPostStatus } from './schemas/planned-post.schema';

interface CreatePlannedPostDto {
  text: string;
  scheduledAt: string; // ISO date
}

/** Minimal CRUD for the content plan. */
@Controller('planned-posts')
export class PlannedPostsController {
  constructor(
    @InjectModel(PlannedPost.name) private readonly plannedPostModel: Model<PlannedPost>,
  ) {}

  @Post()
  create(@Body() dto: CreatePlannedPostDto) {
    return this.plannedPostModel.create({
      text: dto.text,
      scheduledAt: new Date(dto.scheduledAt),
      status: PlannedPostStatus.SCHEDULED,
    });
  }

  @Get()
  list() {
    return this.plannedPostModel.find().sort({ scheduledAt: 1 });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plannedPostModel.deleteOne({ _id: id, status: PlannedPostStatus.SCHEDULED });
  }
}
