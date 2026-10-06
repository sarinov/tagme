import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { ApprovalService } from './approval.service';

export interface ApprovalCard {
  author: string;
  postText: string;
  permalink?: string;
  score: number;
  reason: string;
  draft: string;
}

/**
 * Telegram approval bot (same pattern as the Fastlane agent):
 * each draft arrives as a card with one-tap Approve / Edit / Reject buttons.
 * Edit: tap "Edit", then send the corrected text as a normal message.
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Telegraf;
  private chatId = '';
  /** chatId -> candidateId awaiting edited text */
  private pendingEdits = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ApprovalService))
    private readonly approval: ApprovalService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('telegram.botToken');
    this.chatId = this.config.get<string>('telegram.chatId') ?? '';
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — approval bot disabled');
      return;
    }
    this.bot = new Telegraf(token);
    this.registerHandlers(this.bot);
    void this.bot.launch(() => this.logger.log('Telegram approval bot started'));
  }

  onModuleDestroy() {
    this.bot?.stop('shutdown');
  }

  private registerHandlers(bot: Telegraf) {
    bot.action(/^approve:(.+)$/, async (ctx) => {
      const result = await this.approval.approve(ctx.match[1]);
      await ctx.answerCbQuery();
      await ctx.reply(result);
    });

    bot.action(/^reject:(.+)$/, async (ctx) => {
      const result = await this.approval.reject(ctx.match[1]);
      await ctx.answerCbQuery();
      await ctx.reply(result);
    });

    bot.action(/^edit:(.+)$/, async (ctx) => {
      this.pendingEdits.set(String(ctx.chat?.id), ctx.match[1]);
      await ctx.answerCbQuery();
      await ctx.reply('✏️ Отправь исправленный текст ответа одним сообщением.');
    });

    bot.on('text', async (ctx) => {
      const candidateId = this.pendingEdits.get(String(ctx.chat.id));
      if (!candidateId) return;
      this.pendingEdits.delete(String(ctx.chat.id));
      await this.approval.updateDraft(candidateId, ctx.message.text);
      await ctx.reply(
        `Черновик обновлён:\n\n${ctx.message.text}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Опубликовать', `approve:${candidateId}`),
            Markup.button.callback('🚫 Отклонить', `reject:${candidateId}`),
          ],
        ]),
      );
    });
  }

  /** Sends an approval card; returns Telegram message id. */
  async sendApprovalRequest(candidateId: string, card: ApprovalCard): Promise<number | undefined> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('Telegram not configured — approval request dropped');
      return undefined;
    }
    const text =
      `🧵 Новый кандидат (score ${card.score.toFixed(2)})\n` +
      `${card.reason}\n\n` +
      `👤 @${card.author}\n` +
      `📝 ${card.postText.slice(0, 500)}\n` +
      (card.permalink ? `🔗 ${card.permalink}\n` : '') +
      `\n💬 Черновик ответа:\n${card.draft}`;

    const msg = await this.bot.telegram.sendMessage(
      this.chatId,
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Одобрить', `approve:${candidateId}`),
          Markup.button.callback('✏️ Изменить', `edit:${candidateId}`),
          Markup.button.callback('🚫 Отклонить', `reject:${candidateId}`),
        ],
      ]),
    );
    return msg.message_id;
  }
}
