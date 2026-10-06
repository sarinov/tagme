# App Review screencast — shot-by-shot script (v2, after rejection)

## Fixes required by the rejection notice

1. **Complete Meta login flow on camera**: shot 1 must show threads.net login
   screen (log out first!), entering credentials (blur the password field area or
   type with password hidden), then the consent screen, toggles, and Allow.
2. **English everywhere**: the dashboard UI is now English; captions in English.
3. **Captions/tooltips explaining every button** — before clicking anything, hover
   and let the caption name the button and what it does.
4. **Add to submission notes**: "This is an internal server-side (server-to-server)
   tool. End users never log in — the app acts only on our own Threads business
   account, authorized once via the Threads OAuth flow shown at the start of the
   screencast. The dashboard shown is our internal operator console."


One continuous recording, ~4–5 min, 1080p. Add on-screen captions (or narrate in English)
naming the permission at each step. Meta reviewers reject videos where they can't map
steps to permissions. Hide/blur the app secret and full access tokens.

## Prep before recording

- `.env` filled; app built (`npm run build`); Mongo running; Telegram bot connected.
- Threads profile @<tagme> open in a browser tab, logged in.
- Remove previous test posts to keep the profile clean.
- Terminal font large enough to read at 1080p.

## Shots

**1. Complete Meta login + OAuth authorization** — caption: "Step 1: Threads login and app authorization"
   - Log OUT of threads.net beforehand so the login screen appears on camera.
   - Run `node scripts/get-token.js`, show the printed authorize URL, caption:
     "Our server-side app requests these permissions via the Threads OAuth flow".
   - Open the URL: the threads.net LOGIN screen appears — log in as the business
     account (keep the password itself off-screen/hidden characters).
   - The consent screen lists all requested permissions — slowly scroll through
     all 6 items, caption each ("keyword search", "mentions", ...), click Allow.
   - Show the redirect with the `code` param, run `node scripts/get-token.js <code>`,
     caption: "The server exchanges the code for a long-lived token" (blur the token).

**2. threads_basic** — caption: "threads_basic — read own profile & posts"
   - Run `node scripts/test-threads-api.js`, point at the ✅ get profile / get own posts lines.

**3. threads_keyword_search** — caption: "threads_keyword_search — discover relevant public posts"
   - Same script output: ✅ keyword search line. Then show the app log line
     `"поход Алматы": N results, M new candidates` from the running service
     (`npm run start:dev`, trigger discovery).

**4. threads_manage_mentions** — caption: "threads_manage_mentions — read posts mentioning us"
   - PREP (before recording): from a SECOND, PUBLIC Threads account, publish a
     brand-new TOP-LEVEL post (not a reply, not a quote) that tags the business
     account as a linked blue @handle, e.g. `@<tagme> есть советы по походам в Алматы?`.
     Wait a few minutes so the `/mentions` edge indexes it. Only fresh, public,
     top-level, linked mentions come back from the edge — replies/older mentions do not.
   - On camera: run `node scripts/test-threads-api.js` and point at the ✅ get
     mentions line, then open the dashboard, click "@ Fetch mentions", and show the
     mention appearing in the "Mentions edge (/mentions)" section with the author,
     text and "open in Threads" link.
   - NOTE: the real-time `mentions` WEBHOOK is intentionally not shown — that field
     only becomes subscribable after `threads_manage_mentions` is approved, so for
     this review we demonstrate the permission via the read `/mentions` edge only.

**5. threads_read_replies** — caption: "threads_read_replies — thread context for the reviewer"
   - Script output ✅ get replies.

**6. Human approval + threads_manage_replies** — caption: "human approval; threads_manage_replies — publish approved reply"
   - Show the Telegram chat receiving a draft card (candidate post + suggested reply
     + score), tap ✅ Одобрить.
   - Show the confirmation message, then switch to the browser and show the reply
     live on threads.net under the target post.

**7. threads_content_publish** — caption: "threads_content_publish — scheduled brand post"
   - Create a planned post: `curl -X POST localhost:3000/planned-posts -H 'Content-Type: application/json' -d '{"text":"...","scheduledAt":"<2 min from now>"}'`
   - Show the scheduler log publishing it, then the post appearing on the Threads profile.

**8. Close** — caption: "Internal tool; all replies human-approved; max 15 replies/day"
   - Show the profile with the new post + reply as the final frame.

## After recording

- Check every permission from the submission appears with a visible caption.
- Compress to <200 MB if needed; upload the same video for each permission's
  screencast slot (Meta allows reusing one video).
