import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema';
import { ThreadsTokenService } from './threads-token.service';
import { ThreadsApiService } from './threads-api.service';
import { ThreadsWebhookController } from './threads-webhook.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: ApiToken.name, schema: ApiTokenSchema }])],
  controllers: [ThreadsWebhookController],
  providers: [ThreadsTokenService, ThreadsApiService],
  exports: [ThreadsApiService],
})
export class ThreadsModule {}
