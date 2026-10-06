import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration';
import { ThreadsModule } from './threads/threads.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AgentsModule } from './agents/agents.module';
import { ApprovalModule } from './approval/approval.module';
import { PublishingModule } from './publishing/publishing.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodbUri'),
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThreadsModule,
    DiscoveryModule,
    AgentsModule,
    ApprovalModule,
    PublishingModule,
    AdminModule,
  ],
})
export class AppModule {}
