# Meta App Review — Threads permissions

## Request ONLY these 6

The agent uses exactly: `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_read_replies`, `threads_manage_mentions`, `threads_keyword_search`.

**Remove from the submission**: `threads_profile_discovery`, `threads_share_to_instagram`, `threads_manage_insights`, `threads_delete`, `threads_location_tagging` — the app makes no such API calls, you can't show them in a screencast, and unused permissions are a common rejection reason. Re-submit later if you build cross-posting (`threads_share_to_instagram`) or analytics (`threads_manage_insights`).

## App context (reuse in every answer)

> Tagme Threads Assistant is an internal marketing tool operated by the Tagme team to manage Tagme's own official Threads account. It schedules Tagme's content posts, discovers public conversations about travel and outdoor activities in Kazakhstan, and lets a human team member review and approve every reply before it is published. It is not offered to third parties; it acts only on behalf of the authenticated Tagme account.

## Paste-ready descriptions

### threads_basic
> We use threads_basic to authenticate our own Threads business account, retrieve its profile (username, id) and its published posts so the internal dashboard can display account status and confirm that scheduled posts and approved replies were published successfully. It is the base permission required by all other Threads permissions we request.

### threads_content_publish
> We use threads_content_publish to publish pre-planned marketing posts from our own Threads account on a schedule set by our team (two-step container create + publish flow), and to publish replies that a team member has explicitly approved. Volume is low (a few posts per day, well under rate limits). No content is published without being either authored by our team or approved by a human reviewer.

### threads_manage_replies
> We use threads_manage_replies to post replies from our own account to public posts where users ask questions relevant to travel in Kazakhstan (e.g., looking for trip companions or hiking recommendations). Every reply is drafted in our internal tool and must be approved, optionally edited, or rejected by a human team member before the API call is made. We cap replies at 15 per day to ensure quality and avoid spam.

### threads_read_replies
> We use threads_read_replies to read replies within conversations our account participates in, so our human reviewer sees the full thread context before approving a response, and so we can track engagement with our own posts inside the internal dashboard.

### threads_manage_mentions
> We use threads_manage_mentions to retrieve posts in which our account is @-mentioned (via the mentions endpoint and webhook), so our team can respond promptly to users who ask us questions directly. Responses to mentions follow the same human-approval flow as all other replies.

### threads_keyword_search
> We use threads_keyword_search to find public posts matching a small fixed set of Russian/Kazakh travel-related keywords (e.g., "поход Алматы", "куда сходить выходные"). Results are shown to our team as candidate conversations where a helpful reply may be appropriate. We run scheduled searches within the documented limit (self-capped at 450 queries per rolling 7 days) and cache results to avoid repeat queries.

## Checklist before submitting

- [ ] **Test calls**: in dev mode with your own account, exercise each endpoint at least once in the last 30 days: get profile + posts (`threads_basic`), publish a post (`threads_content_publish`), publish a reply (`threads_manage_replies`), fetch replies to a thread (`threads_read_replies`), fetch mentions (`threads_manage_mentions`), run a keyword search (`threads_keyword_search`).
- [ ] **Screencast** (one video is fine) showing end-to-end: login/token in app → dashboard → scheduled post publishes and appears on Threads → keyword search surfaces a candidate → draft appears in Telegram approval → approve → reply appears on Threads → mention arrives and is answered the same way. Narrate or caption which permission each step uses.
- [ ] Business verification completed (1–2 weeks).
- [ ] Privacy policy URL + data deletion instructions URL set in the app settings.
