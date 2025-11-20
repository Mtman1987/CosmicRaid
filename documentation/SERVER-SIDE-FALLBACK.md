# Server-Side Fallback System

## Overview

The server-side fallback system provides a completely cloud-based solution for generating community spotlight content when your local server (with puppeteer and ffmpeg) is offline.

## How It Works

### Normal Flow (Local Server Online)
1. **Puppeteer + FFmpeg**: Generates shoutout card GIFs locally
2. **Firebase Storage**: Uploads generated GIFs
3. **Discord**: Posts spotlight with header, GIF, and footer

### Server-Side Fallback (Local Server Offline)
1. **Twitch API**: Fetches recent clips from community members
2. **FreeConvert API**: Converts clip MP4 URLs to GIF format
3. **Firebase Storage**: Uploads converted GIFs
4. **Database**: Stores GIF URLs using normal data structure
5. **Discord**: Uses existing embed building and posting flow

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           postCommunitySpotlightMessage()               │
│                  (Entry Point)                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
         ┌────────────────────┐
         │ Try Normal Flow    │
         │ (Local Server)     │
         └─────────┬──────────┘
                   │
                   ▼
            ┌────────────┐
            │ Success?   │
            └─────┬──────┘
                  │
         ┌────────┴────────┐
         │ YES             │ NO
         ▼                 ▼
    ┌────────┐    ┌─────────────────────────┐
    │ Post   │    │ Try Server-Side Fallback│
    │ Normal │    └──────────┬──────────────┘
    └────────┘               │
                             ▼
                    ┌─────────────────────┐
                    │ Fetch Twitch Clips  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Convert to GIF      │
                    │ (FreeConvert API)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Upload to Storage   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Store in Database   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Post to Discord     │
                    │ (Normal Flow)       │
                    └─────────────────────┘
```

## Key Components

### 1. `community-spotlight-serverside-fallback.ts`

Main service file containing:

#### `FreeConvertService` Class
- **`importFromUrl()`**: Imports video from Twitch clip URL to FreeConvert
- **`convertToGif()`**: Converts imported video to GIF format
- **`waitForTask()`**: Polls FreeConvert API for task completion
- **`downloadFile()`**: Downloads the converted GIF
- **`convertVideoUrlToGif()`**: Full pipeline orchestration

#### Public Functions
- **`generateSpotlightServerSideFallback()`**: Main entry point for fallback generation
- **`updateSpotlightWithServerSideFallback()`**: Updates spotlight database with fallback content

### 2. Modified `automated-shoutout-system.ts`

Updated `postCommunitySpotlightMessage()` function:
- Attempts normal spotlight generation first
- Falls back to server-side generation if normal fails
- Falls back to basic "no one live" message if server-side fails

### 3. Enhanced `firebase-storage-service.ts`

Added `uploadToStorage()` function for Buffer uploads.

## Configuration

### Environment Variables

Add to your `.env` file:

```env
FREE_CONVERT_API_KEY=your_freeconvert_api_key_here
```

### Getting a FreeConvert API Key

1. Visit [https://www.freeconvert.com/](https://www.freeconvert.com/)
2. Sign up for an account
3. Navigate to API section
4. Generate an API key
5. Add to your `.env` file

## API Usage & Limits

### FreeConvert API
- **Free Tier**: 750 conversions/month
- **Processing Time**: 10-60 seconds per conversion
- **Max File Size**: Depends on plan (typically 1GB)
- **Max Duration**: No hard limit, but longer = slower

### Optimization Settings

Current configuration (in `convertClipToGif()`):
```typescript
{
  width: 640,        // Reasonable quality
  fps: 15,           // Smooth but not excessive
  duration: 30       // Max 30 seconds (clips can be longer)
}
```

## Data Flow

### Database Schema

The fallback system stores data in the same format as the normal flow:

```typescript
{
  streamerName: string,
  cardGifUrl: string,        // GIF URL in Firebase Storage
  clipUrl: string,            // Original Twitch clip URL
  clipTitle: string,          // Clip title from Twitch
  lastUpdated: string,        // ISO timestamp
  generatedBy: 'server-side-fallback',  // Identifier
  streamData: {
    title: string,
    game: string,
    viewers: number,
    avatarUrl: string
  }
}
```

Stored at: `servers/{serverId}/spotlight/current`

### User Clip Cache

Each user also caches their last server-side fallback clip:

```typescript
{
  lastServerSideFallbackClip: {
    gifUrl: string,
    clipUrl: string,
    clipTitle: string,
    createdAt: string
  }
}
```

Stored at: `servers/{serverId}/users/{userId}`

## Error Handling

### Graceful Degradation

1. **Normal Flow Fails** → Try Server-Side Fallback
2. **Server-Side Fails** → Try Basic Fallback (no GIF, just message)
3. **All Fails** → Log error and skip (cooldown prevents spam)

### Logging

All operations are logged with `[ServerFallback]` prefix:

```typescript
[ServerFallback] Starting server-side fallback for {serverId}
[FreeConvert] Starting conversion: {videoUrl}
[FreeConvert] Import task created: {taskId}
[FreeConvert] Import completed
[FreeConvert] Conversion task created: {taskId}
[FreeConvert] Conversion completed, downloading...
[FreeConvert] Download completed, size: {bytes} bytes
[ServerFallback] GIF uploaded successfully: {gifUrl}
[ServerFallback] Spotlight updated successfully
```

### Common Issues

#### No API Key
```
[FreeConvert] API key not configured
```
**Solution**: Add `FREE_CONVERT_API_KEY` to `.env`

#### No Clips Found
```
[ServerFallback] No clips found for {username}
```
**Solution**: User needs to have created clips within the last 7 days

#### Conversion Timeout
```
Task timeout - conversion took too long
```
**Solution**: Increase `maxWaitMs` in `waitForTask()` (default 60 seconds)

#### Download Failed
```
[FreeConvert] Download failed
```
**Solution**: Check FreeConvert API status and network connectivity

## Testing

### Manual Test

1. Turn off your local server (puppeteer/ffmpeg unavailable)
2. Trigger a community spotlight post
3. Check logs for fallback activation
4. Verify Discord post contains converted GIF

### Debug Mode

Add extra logging:

```typescript
console.log('[DEBUG] Clip MP4 URL:', mp4Url);
console.log('[DEBUG] FreeConvert response:', data);
console.log('[DEBUG] GIF buffer size:', gifBuffer.length);
```

## Performance

### Timing Comparison

| Method | Time | Cost |
|--------|------|------|
| Normal (Local) | 5-15s | Free |
| Server-Side Fallback | 30-90s | API Credits |
| Basic Fallback | Instant | Free |

### Recommendations

1. **Use local server when possible** for best performance
2. **Reserve fallback for offline scenarios** to conserve API credits
3. **Monitor API usage** via FreeConvert dashboard
4. **Cache clips in database** to reduce API calls

## Future Enhancements

### Potential Improvements

1. **Clip Pre-processing**: Convert clips during off-peak hours
2. **Multi-Provider**: Add CloudConvert, Convertio as alternatives
3. **Smart Caching**: Reuse recently converted clips
4. **Priority Queue**: Queue multiple conversions in parallel
5. **Webhook Support**: Use FreeConvert webhooks instead of polling

### Alternative Approaches

1. **Self-Hosted**: Run FFmpeg in Docker on a VPS
2. **Serverless**: Use AWS Lambda with FFmpeg layer
3. **Hybrid**: Mix local and cloud based on load

## Security

### API Key Protection

- ✅ API key stored in `.env` (not committed)
- ✅ Server-side only execution (`'use server'`)
- ✅ No client-side exposure

### Rate Limiting

Current implementation has no rate limiting. Consider adding:

```typescript
// Add to FreeConvertService
private lastRequestTime = 0;
private minRequestInterval = 1000; // 1 second

private async rateLimit() {
  const elapsed = Date.now() - this.lastRequestTime;
  if (elapsed < this.minRequestInterval) {
    await new Promise(r => setTimeout(r, this.minRequestInterval - elapsed));
  }
  this.lastRequestTime = Date.now();
}
```

## Monitoring

### Key Metrics to Track

1. **Fallback Activation Rate**: How often is fallback used?
2. **Conversion Success Rate**: What % of conversions succeed?
3. **Average Conversion Time**: How long does it take?
4. **API Credit Usage**: Are we approaching limits?
5. **Error Frequency**: What types of errors occur?

### Dashboard Ideas

Create a monitoring page showing:
- Recent fallback activations
- Conversion history
- API credit balance
- Error logs

## Maintenance

### Regular Tasks

1. **Weekly**: Check FreeConvert API credit balance
2. **Monthly**: Review error logs for patterns
3. **Quarterly**: Evaluate if fallback is still needed

### Troubleshooting Checklist

- [ ] Is `FREE_CONVERT_API_KEY` set correctly?
- [ ] Are Twitch credentials valid?
- [ ] Can service reach FreeConvert API?
- [ ] Is Firebase Storage accessible?
- [ ] Are there sufficient API credits?
- [ ] Is the clip URL format correct?

## Support

For issues with:
- **FreeConvert API**: [support@freeconvert.com](mailto:support@freeconvert.com)
- **This Implementation**: Check logs and error messages

## Summary

The server-side fallback system ensures your community spotlight always works, even when your local server is offline. It's:

✅ **Fully Automated**: No manual intervention required  
✅ **Cloud-Based**: Works from anywhere  
✅ **Reliable**: Multiple fallback layers  
✅ **Cost-Effective**: Only uses API credits when needed  
✅ **Maintainable**: Well-documented and logged  

Use it as a safety net while keeping your local server as the primary method.
