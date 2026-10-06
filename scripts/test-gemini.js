#!/usr/bin/env node
/**
 * Gemini test — validates the API key + model, then runs the real
 * LangGraph pipeline (relevance filter -> reply drafter) on sample posts.
 *
 * Usage:
 *   node scripts/test-gemini.js        # stage 1 only (no npm install needed)
 *   node scripts/test-gemini.js --pipeline  # + stage 2 (needs: npm install && npm run build)
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.LLM_MODEL || 'gemini-3.1-flash-lite';

if (!KEY) {
  console.error('Set GOOGLE_API_KEY in .env first (https://aistudio.google.com/apikey).');
  process.exit(1);
}

const SAMPLE_POSTS = [
  {
    threadsPostId: 'test-1',
    authorUsername: 'test_user_1',
    matchedKeyword: 'поход Алматы',
    source: 'KEYWORD_SEARCH',
    text: 'Кто ходил на Кольсайские озёра? Ищу попутчиков на выходные, одной страшновато ехать 😅',
  },
  {
    threadsPostId: 'test-2',
    authorUsername: 'test_user_2',
    matchedKeyword: 'попутчики',
    source: 'KEYWORD_SEARCH',
    text: 'Продам гараж в Астане, срочно, недорого. Пишите в личку.',
  },
];

(async () => {
  // --- Stage 1: raw REST call, validates key + model name ---
  console.log(`Stage 1: raw API call to ${MODEL}...`);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Ответь одним словом: столица Казахстана?' }] }],
      }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    console.error(`❌ ${res.status}: ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`✅ Gemini answered: ${body.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}\n`);

  if (!process.argv.includes('--pipeline')) {
    console.log('Key + model OK. Run with --pipeline to test the full LangGraph flow (needs npm install && npm run build).');
    return;
  }

  // --- Stage 2: real pipeline from dist ---
  const distPath = path.join(__dirname, '..', 'dist', 'agents', 'reply-pipeline.graph.js');
  if (!fs.existsSync(distPath)) {
    console.error('dist not found — run: npm install && npm run build');
    process.exit(1);
  }
  const { buildReplyPipeline } = require(distPath);
  const pipeline = buildReplyPipeline({
    googleApiKey: KEY,
    model: MODEL,
    relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD ?? '0.7'),
  });

  for (const candidate of SAMPLE_POSTS) {
    console.log(`--- Post by @${candidate.authorUsername}: "${candidate.text}"`);
    const result = await pipeline.invoke({ candidate });
    console.log(`    score: ${result.relevanceScore} (${result.relevanceReason})`);
    console.log(
      result.isRelevant
        ? `    ✅ draft reply: ${result.draftReply}\n`
        : `    ⛔ filtered out (below threshold)\n`,
    );
  }
})();
