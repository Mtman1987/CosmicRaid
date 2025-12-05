import { NextRequest, NextResponse } from 'next/server';
import { getUserByLogin, getStreamByUserId } from '@/lib/twitch-api-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';
import { generateShoutoutCardGif } from '@/lib/shoutout-card-service';

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
    const streamThumbnail = stream?.thumbnail_url?.replace('{width}', '640').replace('{height}', '360');

    // Generate VIP-style GIF shoutout
    const serverId = '1240832965865635881';
    let gifUrl: string | null = null;
    
    try {
      gifUrl = await generateShoutoutCardGif(serverId, {
        streamerName: username,
        streamTitle,
        gameName: streamGame,
        viewerCount,
        avatarUrl: twitchAvatar,
        streamThumbnail,
        isLive,
        isMature: Boolean(stream?.is_mature),
        group: 'vip'
      });
      console.log('[TestGif] Generated GIF URL:', gifUrl ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.error('[TestGif] GIF generation error:', error);
    }

    // Send to Discord - force placeholder for now to test posting
    let messageId;
    const placeholderUrl = 'https://via.placeholder.com/960x540/9521663/ffffff?text=TEST+GIF+CARD';
    
    console.log('[TestGif] Using placeholder URL for testing:', placeholderUrl);
    messageId = await sendDiscordMessage(channelId, {
      content: placeholderUrl,
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "⚡ JOIN COMMAND (TEST)",
          url: `https://twitch.tv/${username}`
        }]
      }]
    });

    return NextResponse.json({ 
      success: true, 
      messageId,
      gifUrl: gifUrl || 'placeholder',
      isLive,
      streamTitle,
      streamGame,
      viewerCount
    });

  } catch (error) {
    console.error('Test GIF shoutout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}