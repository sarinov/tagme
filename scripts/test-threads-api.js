#!/usr/bin/env node
/**
 * Threads API test calls — one per permission needed for Meta App Review.
 * Reads THREADS_USER_ID and THREADS_ACCESS_TOKEN from .env (or env vars).
 *
 * Usage:
 *   node scripts/test-threads-api.js            # read-only calls only
 *   node scripts/test-threads-api.js --publish  # also publishes a test post + reply to it
 */
const fs = require('fs');
const path = require('path');

// minimal .env loader (no deps)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const USER_ID = process.env.THREADS_USER_ID;
const TOKEN = process.env.THREADS_ACCESS_TOKEN;
const BASE = 'https://graph.threads.net/v1.0';
const DO_PUBLISH = process.argv.includes('--publish');

if (!USER_ID || !TOKEN) {
  console.error('Set THREADS_USER_ID and THREADS_ACCESS_TOKEN in .env first.');
  process.exit(1);
}

const results = [];

async function call(name, permission, method, url, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  try {
    const res = await fetch(`${BASE}${url}?${qs}`, { method });
    const body = await res.json();
    const ok = res.ok && !body.error;
    results.push({ permission, name, ok, detail: ok ? '' : JSON.stringify(body.error ?? body).slice(0, 200) });
    if (ok) console.log(`✅ [${permission}] ${name}`);
    else console.log(`❌ [${permission}] ${name}\n   ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
    return ok ? body : null;
  } catch (err) {
    results.push({ permission, name, ok: false, detail: err.message });
    console.log(`❌ [${permission}] ${name} — ${err.message}`);
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log(`Testing as user ${USER_ID} (publish steps: ${DO_PUBLISH ? 'ON' : 'OFF, use --publish'})\n`);

  // threads_basic — profile + own posts
  await call('get profile', 'threads_basic', 'GET', '/me', {
    fields: 'id,username,threads_profile_picture_url',
  });
  const myPosts = await call('get own posts', 'threads_basic', 'GET', `/${USER_ID}/threads`, {
    fields: 'id,text,permalink,timestamp',
    limit: '5',
  });

  // threads_keyword_search
  await call('keyword search "концерты Алматы"', 'threads_keyword_search', 'GET', '/keyword_search', {
    q: 'концерты Алматы',
    search_type: 'RECENT',
    fields: 'id,text,username,permalink',
  });

  // threads_manage_mentions
  await call('get mentions', 'threads_manage_mentions', 'GET', `/${USER_ID}/mentions`, {
    fields: 'id,text,username,permalink',
  });

  // threads_read_replies — replies to our most recent post (if any)
  const firstPost = myPosts?.data?.[0];
  if (firstPost) {
    await call(`get replies to post ${firstPost.id}`, 'threads_read_replies', 'GET', `/${firstPost.id}/replies`, {
      fields: 'id,text,username',
    });
  } else {
    console.log('⚠️  [threads_read_replies] skipped — no existing posts found');
  }

  // threads_content_publish + threads_manage_replies (two-step flows)
  if (DO_PUBLISH) {
    const container = await call('create post container', 'threads_content_publish', 'POST', `/${USER_ID}/threads`, {
      media_type: 'TEXT',
      text: `API test post from Tagme agent — ${new Date().toISOString()}`,
    });
    if (container?.id) {
      await sleep(3000);
      const published = await call('publish post', 'threads_content_publish', 'POST', `/${USER_ID}/threads_publish`, {
        creation_id: container.id,
      });
      if (published?.id) {
        await sleep(3000);
        const replyContainer = await call('create reply container', 'threads_manage_replies', 'POST', `/${USER_ID}/threads`, {
          media_type: 'TEXT',
          text: 'API test reply 👋',
          reply_to_id: published.id,
        });
        if (replyContainer?.id) {
          await sleep(3000);
          await call('publish reply', 'threads_manage_replies', 'POST', `/${USER_ID}/threads_publish`, {
            creation_id: replyContainer.id,
          });
        }
      }
    }
  } else {
    console.log('⚠️  [threads_content_publish, threads_manage_replies] skipped — rerun with --publish');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} calls succeeded.`);
  process.exit(failed.length ? 1 : 0);
})();
