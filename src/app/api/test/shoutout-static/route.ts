import { NextRequest, NextResponse } from 'next/server';
import { getUserByLogin, getStreamByUserId } from '@/lib/twitch-api-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';

export async function POST(request: NextRequest) {
  try {
    const { username, channelId } = await request.json();
    
    if (!username || !channelId) {
      return NextResponse.json({ error: 'Username and channelId required' }, { status: 400 });
    }

    // Get Twitch data
    const twitchUser = await getUserByLogin(username.toLowerCase());
    const stream = twitchUser ? await getStreamByUserId(twitchUser.id) : null;
    
    const streamTitle = stream?.title || 'Test Stream Title';
    const streamGame = stream?.game_name || 'Just Chatting';
    const viewerCount = stream?.viewer_count ?? 42;
    const isLive = !!stream;
    const twitchAvatar = twitchUser?.profile_image_url;

    // Generate static community-style shoutout
    const serverId = '1240832965865635881';
    let cardUrl: string | null = null;
    
    try {
      const { generateCommunityCardImage } = await import('@/ai/flows/generate-community-card-image');
      cardUrl = await generateCommunityCardImage(serverId, username, {
        title: streamTitle,
        game: streamGame,
        viewers: viewerCount,
        avatarUrl: twitchAvatar,
        thumbnailUrl: stream?.thumbnail_url?.replace('{width}', '640').replace('{height}', '360'),
        isLive,
        group: 'community'
      });
      console.log('[TestStatic] Generated card URL:', cardUrl ? cardUrl.substring(0, 100) + '...' : 'FAILED');
      console.log('[TestStatic] Is base64?', cardUrl?.startsWith('data:'));
    } catch (error) {
      console.error('[TestStatic] Image generation error:', error);
    }

    // Send to Discord - force placeholder for now to test posting
    let messageId;
    const placeholderUrl = 'https://via.placeholder.com/960x360/6570404/ffffff?text=TEST+STATIC+CARD';
    
    console.log('[TestStatic] Using placeholder URL for testing:', placeholderUrl);
    messageId = await sendDiscordMessage(channelId, {
      content: placeholderUrl,
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "🚀 JOIN STREAM (TEST)",
          url: `https://twitch.tv/${username}`
        }]
      }]
    });

    return NextResponse.json({ 
      success: true, 
      messageId,
      cardUrl: cardUrl || 'placeholder',
      isLive,
      streamTitle,
      streamGame,
      viewerCount
    });

  } catch (error) {
    console.error('Test static shoutout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}