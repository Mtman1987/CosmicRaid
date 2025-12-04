# FreeConvert API Integration Fix

## Problem
The app uses FreeConvert API for screenshot fallbacks, but the polling mechanism was too short (only 10 seconds), causing jobs to fail before completion.

## Solution
Updated the polling logic in leaderboard and calendar image generation to poll for up to 60 seconds (20 attempts, 3 seconds apart), matching the successful implementation in community-card-service.ts.

## Changes Made
- [x] Updated `generate-leaderboard-image.ts` to poll for 60 seconds instead of 10 seconds
- [x] Updated `generate-calendar-image.ts` to poll for 60 seconds instead of 10 seconds

## Testing
- Test leaderboard image generation
- Test calendar image generation
- Verify that FreeConvert jobs complete successfully and URLs are retrieved

## Future Improvements
- Implement webhook support to avoid polling entirely
- Add webhook URL to job creation requests
- Poll Firestore for completion instead of API
