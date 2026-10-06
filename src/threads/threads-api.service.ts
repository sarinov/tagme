import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ThreadsTokenService } from './threads-token.service';

const API_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsPost {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp?: string;
}

/**
 * Thin client over the official Threads API.
 * Publishing is a two-step flow: create media container -> publish it.
 * Limits: 250 posts + 1,000 replies per profile / 24h (enforced upstream by ApprovalService caps).
 */
@Injectable()
export class ThreadsApiService {
  private readonly logger = new Logger(ThreadsApiService.name);
  private readonly http: AxiosInstance = axios.create({ baseURL: API_BASE });

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: ThreadsTokenService,
  ) {}

  private get userId(): string {
    return this.config.get<string>('threads.userId') ?? '';
  }

  /** Step 1+2: create a text post container and publish it. Returns published media id. */
  async publishTextPost(text: string): Promise<string> {
    return this.createAndPublish({ media_type: 'TEXT', text });
  }

  /** Reply to an existing public post (requires threads_manage_replies). */
  async publishReply(replyToId: string, text: string): Promise<string> {
    return this.createAndPublish({ media_type: 'TEXT', text, reply_to_id: replyToId });
  }

  private async createAndPublish(params: Record<string, string>): Promise<string> {
    const accessToken = await this.tokens.getAccessToken();
    const { data: container } = await this.http.post(`/${this.userId}/threads`, null, {
      params: { ...params, access_token: accessToken },
    });
    // Meta recommends a short wait before publishing the container.
    await new Promise((r) => setTimeout(r, 2000));
    const { data: published } = await this.http.post(`/${this.userId}/threads_publish`, null, {
      params: { creation_id: container.id, access_token: accessToken },
    });
    this.logger.log(`Published media ${published.id}`);
    return published.id;
  }

  /** Authenticated account's profile. */
  async getProfile(): Promise<{ id: string; username: string; threads_profile_picture_url?: string }> {
    const accessToken = await this.tokens.getAccessToken();
    const { data } = await this.http.get('/me', {
      params: { fields: 'id,username,threads_profile_picture_url', access_token: accessToken },
    });
    return data;
  }

  /** Keyword search of public posts. Costs 1 of the query budget — callers must check budget first. */
  async keywordSearch(query: string, searchType: 'TOP' | 'RECENT' = 'RECENT'): Promise<ThreadsPost[]> {
    const accessToken = await this.tokens.getAccessToken();
    const { data } = await this.http.get('/keyword_search', {
      params: {
        q: query,
        search_type: searchType,
        fields: 'id,text,username,permalink,timestamp',
        access_token: accessToken,
      },
    });
    return data.data ?? [];
  }

  /** Posts where the account is @-mentioned. */
  async getMentions(): Promise<ThreadsPost[]> {
    const accessToken = await this.tokens.getAccessToken();
    const { data } = await this.http.get(`/${this.userId}/mentions`, {
      params: {
        fields: 'id,text,username,permalink,timestamp',
        access_token: accessToken,
      },
    });
    return data.data ?? [];
  }
}
