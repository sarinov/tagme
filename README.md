# Tagme Threads Agent

Automated agent that grows Tagme via Threads: publishes scheduled content, discovers relevant posts (RU/KZ travel queries), and replies with human approval via Telegram.

## Architecture (NestJS + LangGraph.js + MongoDB)

```
Discovery (keyword search cron + mentions webhook)
   → candidate queue (MongoDB)
   → LangGraph pipeline: relevance filter (LLM, threshold) → reply drafter
   → Telegram approval bot (approve / edit / reject)
   → Threads API publish (daily cap)

Content scheduler: planned posts auto-publish, no approval.
```

| Module | Purpose |
|---|---|
| `src/threads` | Threads API client (two-step publish, replies, keyword search, mentions), 60-day token auto-refresh, webhook controller |
| `src/discovery` | Discovery cron with 500/7d search budget guard, candidate ingestion + dedupe |
| `src/agents` | LangGraph pipeline: relevance scoring → reply drafting (prompts in `prompts.ts`) |
| `src/approval` | Telegram bot with one-tap approve/edit/reject, `MAX_REPLIES_PER_DAY` cap |
| `src/publishing` | Planned-post CRUD (`/planned-posts`) + auto-publish cron |

## Setup

```bash
cp .env.example .env   # fill in tokens
npm install
docker compose up mongo -d
npm run start:dev
```

Or fully containerized: `docker compose up --build`.

### Required credentials

- **Threads**: Meta app with `threads_basic`, `threads_content_publish`, `threads_manage_replies` (+ `threads_keyword_search`, `threads_read_replies` for discovery). App Review takes 2–6 weeks; test on your own account meanwhile. Put the long-lived token in `THREADS_ACCESS_TOKEN` — it's persisted to Mongo and auto-refreshed weekly.
- **Google AI**: `GOOGLE_API_KEY` for relevance scoring + drafting (Gemini 3.1 Flash-Lite via `@langchain/google-genai`).
- **Telegram**: bot token from @BotFather, `TELEGRAM_CHAT_ID` of the approval chat.

### Webhooks

Point Meta webhook subscription to `GET/POST /webhooks/threads` (public HTTPS, e.g. via ngrok in dev). Verify token = `THREADS_WEBHOOK_VERIFY_TOKEN`.

## Guardrails baked in

- Search budget: max `SEARCH_BUDGET_24H` (default 2,000 of the 2,200/24h per-user limit; queries with zero results don't count), tracked in Mongo with TTL.
- Reply cap: `MAX_REPLIES_PER_DAY` (default 15) — quality over volume, spam flags are the main risk.
- All replies require Telegram approval; only scheduled posts are fully automated.
- Candidates deduped by post id; drafts mention Tagme only when natural (prompt-enforced).

## Open questions (from handoff)

- Validate KZ audience size on Threads before heavy investment.
- Consider reusing the pipeline for Instagram/Telegram cross-posting.
