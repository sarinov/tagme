export interface AppConfig {
  port: number;
  mongodbUri: string;
  threads: {
    userId: string;
    accessToken: string;
    webhookVerifyToken: string;
  };
  llm: {
    googleApiKey: string;
    model: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
  agent: {
    keywords: string[];
    discoveryCron: string;
    relevanceThreshold: number;
    maxRepliesPerDay: number;
    searchBudget24h: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/tagme-threads',
  threads: {
    userId: process.env.THREADS_USER_ID ?? '',
    accessToken: process.env.THREADS_ACCESS_TOKEN ?? '',
    webhookVerifyToken: process.env.THREADS_WEBHOOK_VERIFY_TOKEN ?? 'change-me',
  },
  llm: {
    googleApiKey: process.env.GOOGLE_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gemini-3.1-flash-lite',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  },
  agent: {
    keywords: (process.env.DISCOVERY_KEYWORDS ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    discoveryCron: process.env.DISCOVERY_CRON ?? '0 */4 * * *',
    relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD ?? '0.7'),
    maxRepliesPerDay: parseInt(process.env.MAX_REPLIES_PER_DAY ?? '15', 10),
    searchBudget24h: parseInt(process.env.SEARCH_BUDGET_24H ?? '2000', 10),
  },
});
