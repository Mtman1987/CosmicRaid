/**
 * Comprehensive diagnostics endpoint
 * Shows what environment variables are available and tests Twitch API
 */

export async function GET(request: Request) {
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    
    // Check all critical environment variables
    secrets: {
      // Firebase
      firebase_project_id: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      firebase_api_key: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      firebase_storage_bucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      google_credentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      
      // Twitch
      twitch_client_id: !!process.env.TWITCH_CLIENT_ID,
      twitch_client_secret: !!process.env.TWITCH_CLIENT_SECRET,
      twitch_broadcaster_id: !!process.env.TWITCH_BROADCASTER_ID,
      twitch_broadcaster_username: !!process.env.TWITCH_BROADCASTER_USERNAME,
      
      // Discord
      discord_bot_token: !!process.env.DISCORD_BOT_TOKEN,
      discord_client_id: !!process.env.DISCORD_CLIENT_ID,
      discord_client_secret: !!process.env.DISCORD_CLIENT_SECRET,
      
      // Other
      free_convert_api_key: !!process.env.FREE_CONVERT_API_KEY,
      local_service_url: !!process.env.LOCAL_CONVERSION_SERVICE_URL,
      local_service_enabled: process.env.LOCAL_SERVICE_ENABLED === 'true',
    },
    
    // Show first few characters of critical keys (for verification)
    keyPreviews: {
      twitch_client_id: process.env.TWITCH_CLIENT_ID?.substring(0, 10) + '...' || 'NOT SET',
      twitch_broadcaster_id: process.env.TWITCH_BROADCASTER_ID || 'NOT SET',
      firebase_project_id: process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT SET',
    },
    
    // Test results will be added below
    tests: {} as any
  };

  // Test 1: Twitch API Connection
  try {
    const twitchClientId = process.env.TWITCH_CLIENT_ID;
    const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
    
    if (!twitchClientId || !twitchClientSecret) {
      results.tests.twitch_connection = {
        status: 'error',
        message: 'Twitch credentials not configured',
        has_client_id: !!twitchClientId,
        has_client_secret: !!twitchClientSecret
      };
    } else {
      // Get Twitch OAuth token
      const tokenResponse = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
      );
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json() as any;
        results.tests.twitch_connection = {
          status: 'success',
          message: 'Successfully connected to Twitch API',
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in
        };
        
        // Test 2: Check if broadcaster is live
        const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
        if (broadcasterId) {
          const streamsResponse = await fetch(
            `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`,
            {
              headers: {
                'Client-ID': twitchClientId,
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            }
          );
          
          if (streamsResponse.ok) {
            const streamsData = await streamsResponse.json() as any;
            const isLive = streamsData.data && streamsData.data.length > 0;
            
            results.tests.broadcaster_status = {
              status: 'success',
              broadcaster_id: broadcasterId,
              is_live: isLive,
              stream_data: isLive ? {
                title: streamsData.data[0].title,
                game_name: streamsData.data[0].game_name,
                viewer_count: streamsData.data[0].viewer_count,
                started_at: streamsData.data[0].started_at
              } : null,
              message: isLive ? 'Broadcaster is LIVE!' : 'Broadcaster is offline'
            };
          } else {
            results.tests.broadcaster_status = {
              status: 'error',
              message: 'Failed to check stream status',
              http_status: streamsResponse.status
            };
          }
        } else {
          results.tests.broadcaster_status = {
            status: 'error',
            message: 'TWITCH_BROADCASTER_ID not set'
          };
        }
        
        // Test 3: Get user info
        const broadcasterUsername = process.env.TWITCH_BROADCASTER_USERNAME;
        if (broadcasterUsername) {
          const usersResponse = await fetch(
            `https://api.twitch.tv/helix/users?login=${broadcasterUsername}`,
            {
              headers: {
                'Client-ID': twitchClientId,
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            }
          );
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json() as any;
            if (usersData.data && usersData.data.length > 0) {
              results.tests.user_info = {
                status: 'success',
                username: usersData.data[0].login,
                display_name: usersData.data[0].display_name,
                user_id: usersData.data[0].id,
                profile_image: usersData.data[0].profile_image_url
              };
            }
          }
        }
        
      } else {
        const errorText = await tokenResponse.text();
        results.tests.twitch_connection = {
          status: 'error',
          message: 'Failed to get Twitch OAuth token',
          http_status: tokenResponse.status,
          error: errorText.substring(0, 200)
        };
      }
    }
  } catch (error: any) {
    results.tests.twitch_connection = {
      status: 'error',
      message: 'Exception testing Twitch API',
      error: error.message
    };
  }

  // Test 4: Firebase connection
  try {
    const { db } = await import('@/firebase/server-init');
    const testDoc = await db.collection('_diagnostics').doc('test').get();
    results.tests.firebase_connection = {
      status: 'success',
      message: 'Firebase initialized successfully',
      can_read: true
    };
  } catch (error: any) {
    results.tests.firebase_connection = {
      status: 'error',
      message: 'Firebase initialization failed',
      error: error.message
    };
  }

  // Summary
  const allSecretsPresent = Object.values(results.secrets).every(v => v === true);
  const criticalSecretsPresent = results.secrets.twitch_client_id && 
                                  results.secrets.twitch_client_secret && 
                                  results.secrets.twitch_broadcaster_id;

  results.summary = {
    all_secrets_present: allSecretsPresent,
    critical_secrets_present: criticalSecretsPresent,
    twitch_working: results.tests.twitch_connection?.status === 'success',
    firebase_working: results.tests.firebase_connection?.status === 'success',
    ready_for_streaming: criticalSecretsPresent && 
                         results.tests.twitch_connection?.status === 'success' &&
                         results.tests.firebase_connection?.status === 'success'
  };

  // Recommendations
  results.recommendations = [];
  
  if (!criticalSecretsPresent) {
    results.recommendations.push('❌ Upload Twitch secrets: firebase apphosting:secrets:set TWITCH_CLIENT_ID');
    results.recommendations.push('❌ Upload Twitch secrets: firebase apphosting:secrets:set TWITCH_CLIENT_SECRET');
    results.recommendations.push('❌ Upload Twitch secrets: firebase apphosting:secrets:set TWITCH_BROADCASTER_ID');
  }
  
  if (results.tests.twitch_connection?.status !== 'success') {
    results.recommendations.push('⚠️  Twitch API connection failed - check credentials');
  }
  
  if (results.tests.broadcaster_status?.status === 'error') {
    results.recommendations.push('⚠️  Cannot check stream status - verify TWITCH_BROADCASTER_ID');
  }
  
  if (results.tests.firebase_connection?.status !== 'success') {
    results.recommendations.push('⚠️  Firebase not initialized - check FIREBASE_ADMIN_PROJECT_ID and credentials');
  }
  
  if (results.summary.ready_for_streaming) {
    results.recommendations.push('✅ All systems operational! Ready for streaming!');
  }

  return Response.json(results, {
    status: results.summary.ready_for_streaming ? 200 : 500,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}
