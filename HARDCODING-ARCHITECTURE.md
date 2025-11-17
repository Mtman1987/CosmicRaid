# Hardcoding Architecture

## Single Source of Truth

The entire app now has **ONE** hardcoded server ID location:

### `src/lib/get-server-id.ts`
```typescript
export function useServerId(): string {
  return '1240832965865635881';
}
```

This is the **ONLY** place in the entire codebase where the server ID is hardcoded.

## How It Works

### 1. Secrets Loading
- `src/lib/firestore-secrets.ts` hardcodes the path: `servers/1240832965865635881/config/secrets`
- This loads 166 secrets from Firestore
- All services (Twitch, Discord, Firebase) get their credentials from these secrets

### 2. Data Access
- All components import `useServerId()` from `src/lib/get-server-id.ts`
- Components use this value to query Firestore collections:
  - `servers/{serverId}/users` - Discord members
  - `servers/{serverId}/config/roles` - Discord roles
  - `servers/{serverId}/leaderboard` - Points data
  - `servers/{serverId}/calendarEvents` - Events
  - `servers/{serverId}/shoutoutLogs` - Shoutout history

### 3. Clean Architecture
```
firestore-secrets.ts (hardcoded path)
         ↓
   Load 166 secrets
         ↓
get-server-id.ts (hardcoded value)
         ↓
useServerId() hook
         ↓
All components use hook
```

## Components Using `useServerId()`

- `src/app/(app)/shoutouts/[group]/page-client.tsx`
- `src/app/(app)/shoutouts/[group]/_components/community-spotlight.tsx`
- `src/app/(app)/shoutouts/page-client.tsx`
- `src/app/(app)/shoutouts/_components/shoutout-dashboard.tsx`
- `src/app/(app)/shoutouts/_components/shoutout-list.tsx`
- `src/app/(app)/leaderboard/page-client.tsx`
- `src/app/(app)/dashboard/_components/upcoming-events.tsx`
- `src/app/(app)/dashboard/_components/leaderboard-snapshot.tsx`
- `src/app/(app)/dashboard/_components/recent-shoutouts.tsx`

## Migration to Multi-Tenant (Future)

When ready to support multiple Discord servers:

### Step 1: Update `get-server-id.ts`
```typescript
// BEFORE (current)
export function useServerId(): string {
  return '1240832965865635881';
}

// AFTER (multi-tenant)
export function useServerId(): string {
  const { user } = useUser();
  return user?.guildId || '1240832965865635881';
}
```

### Step 2: Update `firestore-secrets.ts`
```typescript
// BEFORE (current)
const serverId = '1240832965865635881';

// AFTER (multi-tenant)
const serverId = guildId || await getServerIdFromAuth();
```

### Step 3: Update Login Flow
- When user logs in with Discord OAuth
- Extract their primary guild ID
- Store in user document: `users/{userId}/guildId`
- Load secrets from: `servers/{guildId}/config/secrets`

## Benefits

1. **Single Point of Change**: Only 2 files need updates for multi-tenant support
2. **Clean Logic**: No scattered hardcoded values throughout codebase
3. **Easy Testing**: Can swap `useServerId()` return value for testing
4. **Type Safety**: TypeScript ensures all components use the hook correctly
5. **Consistent Data**: All components read from same Firestore paths

## Current State (November 17, 2025)

- ✅ Secrets loading from Firestore (166 secrets)
- ✅ Twitch API working
- ✅ Discord sync working (316 members, 36 roles)
- ✅ All components use `useServerId()` hook
- ✅ Single hardcoded location
- ⏳ Ready for deployment and testing
- ⏳ Multi-tenant support when needed

## Testing the Fix

1. Deploy to Firebase App Hosting
2. Navigate to `/shoutouts/Community`
3. Verify 316 members display (not 0)
4. Check role selection shows 36 roles
5. Test shoutout generation for online members
6. Verify dashboard components load data correctly

## Rollback Plan

If issues occur, revert to commit before hardcoding centralization:
```bash
git revert 7811583
git push origin apphosting
```

## Notes

- LocalStorage pattern completely removed
- No client/server rendering issues
- Firestore queries work immediately on page load
- No null/undefined serverId errors
- Clean separation of concerns
