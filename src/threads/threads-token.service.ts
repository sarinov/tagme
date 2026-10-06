import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { ApiToken } from './schemas/api-token.schema';

const THREADS_GRAPH_URL = 'https://graph.threads.net';

/**
 * Holds the long-lived Threads access token (valid 60 days) and refreshes it
 * weekly via GET /refresh_access_token. Seeded from THREADS_ACCESS_TOKEN env
 * on first boot, persisted in Mongo afterwards.
 */
@Injectable()
export class ThreadsTokenService implements OnModuleInit {
  private readonly logger = new Logger(ThreadsTokenService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(ApiToken.name) private readonly tokenModel: Model<ApiToken>,
  ) {}

  async onModuleInit() {
    const existing = await this.tokenModel.findOne({ provider: 'threads' });
    const envToken = this.config.get<string>('threads.accessToken');
    if (!existing && envToken) {
      await this.tokenModel.create({
        provider: 'threads',
        accessToken: envToken,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      });
      this.logger.log('Seeded Threads token from env');
    }
  }

  async getAccessToken(): Promise<string> {
    const doc = await this.tokenModel.findOne({ provider: 'threads' });
    const token = doc?.accessToken ?? this.config.get<string>('threads.accessToken');
    if (!token) throw new Error('No Threads access token configured');
    return token;
  }

  /** Weekly refresh — long-lived tokens must be >24h old and unexpired to refresh. */
  @Cron('0 3 * * 1')
  async refreshToken() {
    try {
      const current = await this.getAccessToken();
      const { data } = await axios.get(`${THREADS_GRAPH_URL}/refresh_access_token`, {
        params: { grant_type: 'th_refresh_token', access_token: current },
      });
      await this.tokenModel.updateOne(
        { provider: 'threads' },
        {
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
        { upsert: true },
      );
      this.logger.log(`Threads token refreshed, expires in ${data.expires_in}s`);
    } catch (err) {
      this.logger.error(`Token refresh failed: ${(err as Error).message}`);
    }
  }
}
