# CosmicRaid Development TODO

## Completed
- [x] Fixed Discord button emoji errors in calendar and shoutout systems
- [x] Updated FreeConvert polling to 60 seconds for leaderboard and calendar generation

## High Priority

### Calendar System Fixes
- [x] Fix calendar screenshot styling (added headless layout for CSS loading)
- [x] Discord button modal functionality (already implemented in interactions route)
- [x] Auto-refresh calendar screenshot after data updates (refreshCalendarMessage)
- [x] Calendar embed updates when new events are added (submitCaptainLog/submitMission)
- [x] **URGENT: Configure Discord Interactions Endpoint URL**
  - [x] Added Discord signature verification for security compliance
  - **STEP 1**: Deploy updated code with signature verification
  - **STEP 2**: Set Interactions Endpoint URL in Discord Developer Portal
    - URL: `https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/api/discord/interactions`
  - **NOTE**: Discord buttons will send HTTP POST requests to this endpoint
  - **SECURITY**: Ed25519 signature verification now implemented
- [x] Fix calendar background (applied same gradient as leaderboard)
- [x] Fix calendar message tracking (now updates existing message instead of creating new ones)
- [x] Fix Discord button interaction responses (now responds immediately and updates asynchronously)
- [x] Fix calendar screenshot timing (increased wait time from 2s to 4s and added component selector)
- [x] Test Discord button interactions end-to-end
- [x] Verify calendar refresh triggers properly

### Leaderboard & Points System
- [x] Fix leaderboard generation and display issues (applied calendar-style container fixes)
- [x] Fix leaderboard screenshot dimensions and timing (updated to 960x540 with 4s wait)
- [ ] Verify points calculation and attribution
- [x] Add "Check Rank" button functionality to leaderboard posts (fixed custom_id mismatch)
- [ ] Test leaderboard screenshot generation with local services

### Shoutout Systems
- [x] Fix community shoutout card container sizing (applied calendar-style fixes)
- [x] Fix shoutout card screenshot service (updated selector and timing)
- [x] Fix Discord config mismatch in community spotlight (channel field name)
- [x] Fix VIP animated GIF generation (integrated with local services /convert-gif endpoint)
- [x] Fix GIF data structure and parameter passing for shoutout cards
- [x] Fix Discord posting to handle GIF URLs from VIP shoutouts
- [x] Fix channel configuration field names (vip/community instead of vipShoutouts/mountaineerShoutouts)
- [x] Verify cron endpoint integration (/api/cron/shoutouts working with unified cron service)
- [x] Fix stale user online status (force update all users in cron, added /api/force-update-users)
- [x] Add manual update buttons to shoutout pages (Update Users & Post to Discord)
- [x] Fix VIP user persistence issues (fixed user ID handling in ManageMembersDialog)
- [x] Fix VIP online display (VIP users now show as online regardless of streaming status)
- [x] Fix Twitch API authentication (now passes serverId to load correct credentials)
- [ ] Build out raid pile shoutouts functionality
- [x] **URGENT: Fix Discord message length limit errors (BASE_TYPE_MAX_LENGTH)**
  - [x] Added base64 data URL detection and rejection in discord-bot-service.ts
  - [x] System now rejects base64 URLs and forces use of storage URLs
  - [x] Fallback to embed format when base64 detected (should not happen with proper storage)
- [ ] Test complete VIP GIF workflow end-to-end
- [ ] Test shoutout posting to correct Discord channels

### Raid Pile Functionality
- [ ] Build out complete raid pile feature set
- [ ] Implement raid pile user management
- [ ] Add raid pile specific shoutout templates
- [ ] Create raid pile leaderboard section

## Medium Priority

### Local Services Connection
- [x] Clean up local services sidekick (created minimal CosmicRaid-Sidekick package)
- [x] Create distribution-ready package with essential files only
- [x] Add easy setup scripts and documentation
- [ ] Test screenshot and conversion services locally
- [ ] Distribute to community for testing

## Future Features

### User Status Dashboard - ACTIVE IMPLEMENTATION
- [x] Create ActiveUsersHeader component for main layout
- [x] Implement /api/active-users endpoint
- [x] Update user-server-mapping.ts with activity tracking
- [x] Add useActivityTracker hook and /api/user-activity endpoint
- [x] Add ActiveUsersHeader to main layout
- [x] Create test user button in settings page
- [x] Add /api/test-user endpoint for button functionality
- [x] Fix Firestore errors in active users API (added error handling)
- [x] Fix Firestore composite index error (simplified query to avoid index requirement)
- [x] Fix additional Firestore index error (now uses only serverId filter, handles time/online filtering in memory)
- [x] Fix user activity tracking (now properly creates/updates user mappings with serverId)
- [ ] Test with real user + test user display
- [ ] Add red/green status circles for local service connectivity
- [ ] Display which user is hosting local services
- [ ] Real-time status updates for service availability
- [ ] Implement service failover between multiple users

#### Implementation Steps:

**Phase 1 - Basic Avatar Display:**
1. Create components/active-users-header.tsx
2. Add to main layout (src/app/(app)/layout.tsx)
3. Create /api/active-users endpoint
4. Update userServerMappings with lastSeen, isOnline fields
5. Add test user document to Firestore:
   ```
   userServerMappings/test_user_123: {
     userId: "test_user_123",
     serverId: "1240832965865635881", 
     twitchUsername: "testuser",
     isOnline: true,
     lastSeen: new Date()
   }
   ```
6. Cross-reference servers/{serverId}/users for avatars

**Phase 2 - Activity Tracking:**
- Update lib/user-server-mapping.ts with updateUserActivity()
- Add useActivityTracker hook to main layout
- 30-second refresh interval for avatar display

**Phase 3 - Service Status:**
- Add localServices field to userServerMappings
- Create /api/user-health endpoint
- Add green/red status circles
- useHealthMonitor hook for service pinging

**Test Data Structure:**
```typescript
// userServerMappings expansion
{
  userId: string,
  serverId: string, 
  twitchUsername: string,
  lastSeen: Date,
  isOnline: boolean,
  localServices?: {
    tunnelUrl?: string,
    screenshotService: boolean,
    conversionService: boolean,
    lastHealthCheck: Date
  }
}
```

### API Optimization & Performance
- [ ] Implement API rate limiting and caching
- [ ] Add Redis/memory cache for frequently accessed data
- [ ] Batch Firestore operations where possible
- [ ] Cache Discord API responses (user data, channels, roles)
- [ ] Implement request deduplication for concurrent calls
- [ ] Add API response caching headers
- [ ] Batch Discord message operations
- [ ] Cache leaderboard data with TTL
- [ ] Optimize database queries with proper indexing
- [ ] Implement background job processing for heavy operations

#### Caching Strategy:
- **User Data**: 5 minutes TTL
- **Leaderboard**: 2 minutes TTL  
- **Discord Channels/Roles**: 30 minutes TTL
- **Calendar Events**: 1 minute TTL
- **Screenshots**: 10 minutes TTL

#### Batch Operations:
- Group multiple Discord API calls
- Batch Firestore writes in transactions
- Queue image generation requests
- Combine multiple user activity updates

### Infrastructure Improvements
- [ ] Implement FreeConvert webhook support
- [ ] Add Firestore polling for job completion
- [ ] Optimize image generation pipeline
- [ ] Add service health monitoring
