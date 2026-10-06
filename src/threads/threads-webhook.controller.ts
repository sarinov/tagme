import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const THREADS_MENTION_EVENT = 'threads.mention';
export const THREADS_REPLY_EVENT = 'threads.reply';

/**
 * Receives Threads webhooks (mentions, replies, post published/deleted).
 * GET  /webhooks/threads — Meta verification handshake
 * POST /webhooks/threads — event delivery
 */
@Controller('webhooks/threads')
export class ThreadsWebhookController {
  private readonly logger = new Logger(ThreadsWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && token === this.config.get('threads.webhookVerifyToken')) {
      return challenge;
    }
    throw new Error('Webhook verification failed');
  }

  @Post()
  @HttpCode(200)
  receive(@Body() body: any): string {
    this.logger.debug(`Webhook payload: ${JSON.stringify(body)}`);
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field === 'mentions') {
          this.events.emit(THREADS_MENTION_EVENT, change.value);
        } else if (change.field === 'replies') {
          this.events.emit(THREADS_REPLY_EVENT, change.value);
        }
      }
    }
    return 'OK';
  }
}
