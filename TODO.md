# CosmicRaid Development TODO

## Completed
- [x] Fixed Discord button emoji errors in calendar and shoutout systems
- [x] Updated FreeConvert polling to 60 seconds for leaderboard and calendar generation

## High Priority

### Leaderboard & Points System
- [ ] Fix leaderboard generation and display issues
- [ ] Verify points calculation and attribution
- [ ] Add "Check Rank" button functionality to leaderboard posts
- [ ] Test leaderboard screenshot generation with local services

### Shoutout Systems
- [ ] Fix and test community shoutouts
- [ ] Fix and test VIP shoutouts  
- [ ] Build out raid pile shoutouts functionality
- [ ] Verify automated shoutout cycles work correctly
- [ ] Test shoutout posting to correct Discord channels

### Raid Pile Functionality
- [ ] Build out complete raid pile feature set
- [ ] Implement raid pile user management
- [ ] Add raid pile specific shoutout templates
- [ ] Create raid pile leaderboard section

## Medium Priority

### Local Services Connection
- [ ] Fix local service connectivity issues
- [ ] Resolve tunnel configuration problems
- [ ] Figure out distribution strategy for local services
- [ ] Implement ngrok parallel endpoints to same domain
- [ ] Test screenshot and conversion services locally

## Future Features

### User Status Dashboard
- [ ] Show logged-in user avatars across header
- [ ] Add red/green status circles for local service connectivity
- [ ] Display which user is hosting local services
- [ ] Real-time status updates for service availability
- [ ] Implement service failover between multiple users

#### Implementation Strategy:
**Data Structure - Expand userServerMappings:**
- Add lastSeen, isOnline, localServices fields
- localServices: { tunnelUrl, screenshotService, conversionService, lastHealthCheck }

**Multi-layered Health Checks:**
- Client-side: 1.5 minute intervals for active users (useHealthMonitor hook)
- Page events: Immediate updates on focus/visibility change (useActivityTracker)
- Cron job: 10 minute cleanup of inactive users (existing cron expanded)

**Components:**
- ActiveUsersDisplay component for header avatars
- Cross-reference Discord users collection for avatars/usernames
- Health check API endpoint (/api/user-health)
- Activity tracker API (/api/user-activity)

**Benefits:**
- Reuses existing userServerMappings collection
- Near real-time status without system overload
- Automatic cleanup of stale sessions
- Visual indication of service availability

### Infrastructure Improvements
- [ ] Implement FreeConvert webhook support
- [ ] Add Firestore polling for job completion
- [ ] Optimize image generation pipeline
- [ ] Add service health monitoring
