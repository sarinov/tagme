#!/usr/bin/env node
/**
 * Manual Threads OAuth — workaround for the User Token Generator
 * requesting a stale scope list.
 *
 * Setup (once): in the app dashboard -> Use cases -> Access the Threads API ->
 * Settings, add "https://localhost/callback" to Redirect Callback URLs.
 * Put THREADS_APP_ID and THREADS_APP_SECRET in .env
 * (App ID/Secret: dashboard -> App settings -> Basic).
 *
 * Usage:
 *   node scripts/get-token.js            # step 1: prints the authorize URL
 *   node scripts/get-token.js <code>     # step 2: exchanges code -> long-lived token
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

const APP_ID = process.env.THREADS_APP_ID;
const APP_SECRET = process.env.THREADS_APP_SECRET;
const REDIRECT_URI = process.env.THREADS_REDIRECT_URI || 'https://localhost/callback';
const SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_replies',
  'threads_read_replies',
  'threads_manage_mentions',
  'threads_keyword_search',
].join(',');

if (!APP_ID) {
  console.error('Set THREADS_APP_ID (and THREADS_APP_SECRET) in .env first.');
  process.exit(1);
}

const code = process.argv[2];

(async () => {
  if (!code) {
    console.log('1. Make sure this redirect URI is registered in the use case settings:');
    console.log(`   ${REDIRECT_URI}\n`);
    console.log('2. Open this URL in a browser logged into the Tagme Threads account:\n');
    console.log(
      `https://threads.net/oauth/authorize?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI,
      )}&response_type=code&scope=${SCOPES}\n`,
    );
    console.log('   The consent screen MUST list keyword search + mentions this time.');
    console.log('3. After approving, copy the code from the address bar (...?code=XXXX#_)');
    console.log('   and run: node scripts/get-token.js XXXX');
    return;
  }

  if (!APP_SECRET) {
    console.error('Set THREADS_APP_SECRET in .env (App settings -> Basic -> App secret).');
    process.exit(1);
  }

  // strip the trailing #_ that Threads appends
  const cleanCode = code.replace(/#_$/, '');

  // Step A: code -> short-lived token
  const res = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code: cleanCode,
    }),
  });
  const shortLived = await res.json();
  if (!res.ok || shortLived.error) {
    console.error('❌ code exchange failed:', JSON.stringify(shortLived).slice(0, 400));
    console.error('   (codes are single-use and expire quickly — redo the authorize step)');
    process.exit(1);
  }
  console.log(`✅ short-lived token for user ${shortLived.user_id}`);

  // Step B: short-lived -> long-lived (60 days)
  const res2 = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${shortLived.access_token}`,
  );
  const longLived = await res2.json();
  if (!res2.ok || longLived.error) {
    console.error('❌ long-lived exchange failed:', JSON.stringify(longLived).slice(0, 400));
    process.exit(1);
  }

  console.log(`✅ long-lived token (expires in ${Math.round(longLived.expires_in / 86400)} days)\n`);
  console.log('Put these in .env:\n');
  console.log(`THREADS_USER_ID=${shortLived.user_id}`);
  console.log(`THREADS_ACCESS_TOKEN=${longLived.access_token}`);
})();
