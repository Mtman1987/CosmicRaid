# LocalStorage Migration Status

## COMPLETED ✅

### Channel Configuration (Firestore)
- ✅ `src/lib/use-server-config.ts` - Created hooks for Firestore configuration
- ✅ `useShoutoutChannel(groupKey)` - Replaces localStorage for shoutout channels
- ✅ `useCalendarChannel()` - Replaces localStorage for calendar channel
- ✅ `useServerConfig()` - General configuration hook

### Updated Components
- ✅ `src/app/(app)/shoutouts/_components/shoutout-list.tsx` - Uses useShoutoutChannel
- ✅ `src/app/(app)/shoutouts/[group]/page-client.tsx` - Uses useShoutoutChannel

## IN PROGRESS ⏳

### Client-Side Components (Need Firestore Migration)

1. **Settings Page** - `src/app/(app)/settings/page-client.tsx`
   - `localStorage.getItem('discordServerId')` → use `useServerId()`
   - `localStorage.getItem('discordBotToken')` → REMOVE (use secrets from Firestore)
   - `localStorage.setItem('discordBotToken')` → REMOVE (security risk!)
   - `localStorage.clear()` → Update to only clear auth tokens

2. **Settings Components**
   - `src/app/(app)/settings/_components/discord-sync-settings.tsx`
     - `localStorage.getItem('discordServerId')` → use `useServerId()`
   
   - `src/app/(app)/settings/_components/twitch-polling-settings.tsx`
     - `localStorage.getItem('discordServerId')` → use `useServerId()`
   
   - `src/app/(app)/settings/_components/channel-selection-settings.tsx`
     - `localStorage.getItem('discordServerId')` → use `useServerId()`
   
   - `src/app/(app)/settings/_components/ui-settings.tsx`
     - `localStorage.getItem('themeSettings')` → Keep (UI preference is OK in localStorage)
     - `localStorage.setItem('themeSettings')` → Keep (UI preference is OK in localStorage)

3. **Calendar Page** - `src/app/(app)/calendar/page-client.tsx`
   - `localStorage.getItem('discordServerId')` → use `useServerId()`
   - `localStorage.getItem('discordUserId')` → use `useUserId()` (need to create)
   - `localStorage.getItem('calendarChannelId')` → use `useCalendarChannel()`
   - `localStorage.setItem('calendarChannelId')` → use `saveChannel()` from hook

4. **Forwarding Page** - `src/app/(app)/forwarding/page-client.tsx`
   - `localStorage.getItem('discordServerId')` → use `useServerId()`
   - `localStorage.getItem('discordUserId')` → use `useUserId()` (need to create)

5. **User Nav** - `src/app/(app)/_components/user-nav.tsx`
   - `localStorage.getItem('discordServerId')` → use `useServerId()`
   - `localStorage.getItem('discordUserId')` → use `useUserId()` (need to create)

6. **Shoutouts Page** - `src/app/(app)/shoutouts/page-client.tsx`
   - `localStorage.getItem('discordServerId')` → Already using `useServerId()`

## NEEDS DIFFERENT SOLUTION 🔧

### Auth/Login Components (Keep localStorage for session)
These should stay in localStorage since they're auth tokens, NOT configuration:

- ✅ `src/app/page.tsx` - Temporary auth bypass (OK to keep)
- ✅ `src/app/login/page-client.tsx` - Login form (OK to keep)
- ✅ `src/components/auth-guard.tsx` - Auth check (OK to keep)
- ✅ `src/hooks/use-space-mountain-auth.ts` - Auth hook (OK to keep)

### Server-Side Files (Need getSecrets/getConfig)

1. **Discord Sync Service** - `src/lib/discord-sync-service.ts`
   ```typescript
   // BEFORE
   const token = process.env.DISCORD_BOT_TOKEN;
   
   // AFTER
   import { getSecret } from './firestore-secrets';
   const token = await getSecret('DISCORD_BOT_TOKEN');
   ```

2. **Twitch API Service** - `src/lib/twitch-api-service.ts`
   ```typescript
   // BEFORE
   this.clientId = process.env.TWITCH_CLIENT_ID!;
   this.clientSecret = process.env.TWITCH_CLIENT_SECRET!;
   
   // AFTER
   import { getSecrets } from './firestore-secrets';
   const secrets = await getSecrets();
   this.clientId = secrets.TWITCH_CLIENT_ID!;
   this.clientSecret = secrets.TWITCH_CLIENT_SECRET!;
   ```

3. **Points Configuration** - All services with points values
   - `src/lib/community-tracking-service.ts`
   - `src/lib/raid-pile-service.ts`
   - `src/lib/points-service.ts`
   
   Instead of:
   ```typescript
   parseInt(process.env.POINTS_TWITCH_FOLLOW || '25')
   ```
   
   Use:
   ```typescript
   import { getSecret } from './firestore-secrets';
   const points = parseInt(await getSecret('POINTS_TWITCH_FOLLOW') || '25');
   ```

4. **API Keys**
   - `src/lib/gif-conversion-service.ts` - FREE_CONVERT_API_KEY, SHOTSTACK_API_KEY
   - `src/lib/media-fallback-service.ts` - FREE_CONVERT_API_KEY
   - All should use `getSecret()` instead of `process.env`

## MIGRATION STRATEGY

### Phase 1: Client Components (Today) ⏳
1. Create `useUserId()` hook in `get-server-id.ts`
2. Update all client components to use hooks instead of localStorage
3. Remove all localStorage for configuration (keep auth tokens)

### Phase 2: Server Services (Next)
1. Update all services to use `getSecret()` from firestore-secrets
2. Remove all `process.env` except NODE_ENV and NEXT_PUBLIC_*
3. Test all API integrations

### Phase 3: Configuration Management (Future)
1. Build admin UI for updating secrets in Firestore
2. Add validation for required secrets
3. Add secret rotation support

## WHY THIS MATTERS

### Current Problems
- ❌ LocalStorage doesn't work server-side
- ❌ Causes "0 members" bugs due to null values
- ❌ Data not shared between tabs/windows
- ❌ Secrets hardcoded in multiple places
- ❌ No central configuration management

### After Migration
- ✅ Server-side rendering works correctly
- ✅ All data loads immediately
- ✅ Configuration shared across all clients
- ✅ Single source of truth (Firestore)
- ✅ Easy to update configuration without code changes
- ✅ Secure secret management

## TESTING CHECKLIST

After completing migration:
- [ ] Navigate to `/shoutouts/Community` - see 316 members
- [ ] Save shoutout channel - persists after refresh
- [ ] Navigate to `/calendar` - see events
- [ ] Save calendar channel - persists after refresh
- [ ] Check `/settings` - all data loads correctly
- [ ] Discord sync works
- [ ] Twitch API works
- [ ] Points system works
- [ ] No console errors about null/undefined IDs
- [ ] Server-side rendering works (view page source)

## FILES TO UPDATE NEXT

Priority order:
1. ⏳ `src/lib/get-server-id.ts` - Add useUserId() hook
2. ⏳ `src/app/(app)/calendar/page-client.tsx` - Remove localStorage
3. ⏳ `src/app/(app)/settings/page-client.tsx` - Remove localStorage (except botToken which should be removed entirely)
4. ⏳ `src/app/(app)/_components/user-nav.tsx` - Use hooks
5. ⏳ All settings sub-components
6. ⏳ `src/lib/discord-sync-service.ts` - Use getSecret()
7. ⏳ `src/lib/twitch-api-service.ts` - Use getSecrets()
8. ⏳ All services with process.env usage
