# Hard-Coded Hosted URL References

If/when you change the hosted base URL, update these spots (line numbers are approximate and may shift with edits):

- `src/lib/base-url.ts:1` — fallback `HOSTED_FALLBACK`
- `src/lib/auto-startup.ts:20` — fallback used for startup ping
- `src/lib/automated-shoutout-system.ts:32` — invite URL fallback
- `src/lib/community-card-service.ts:30` — fallback for community cards
- `src/lib/community-spotlight-enhanced-service.ts:9` — fallback for spotlight enhanced
- `src/lib/community-spotlight-fallback-service.ts:12` — fallback for spotlight fallback
- `src/lib/footer-recording-service.ts:10,46` — fallback for footer recordings (mp4/gif)
- `src/lib/leaderboard-service.ts` — now uses `getBaseUrl` (update `globalConfig/ngrok.BASE_URL` instead of code)
- `src/lib/leaderboard-discord-service.ts` — uses `getBaseUrl`
- `src/lib/leaderboard-screenshot-service.ts` — uses `getBaseUrl`
- `src/lib/ai/flows/generate-calendar-image.ts` — uses `getBaseUrl`
- `src/lib/ai/flows/generate-leaderboard-image.ts` — uses `getBaseUrl`
- `src/lib/media-fallback-service.ts:244` — fallback for leaderboard screenshot URL
- `src/lib/shoutout-card-service.ts:20` — fallback for shoutout card URL

Dev/test scripts with hard-coded URLs (safe to leave unless you care about test endpoints):
- `development/test-calendar-screenshot.js`
- `development/test-freeconvert-webpage.js`
- `development/test-freeconvert-screenshot.js`
- `development/test-local-service.js`

Preferred place to set the base URL going forward: Firestore `globalConfig/ngrok` document, field `BASE_URL` (read by `getBaseUrl`). No envs needed on hosting.
