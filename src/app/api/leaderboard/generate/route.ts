import { NextRequest, NextResponse } from 'next/server';
import { takeLeaderboardScreenshot } from '@/lib/leaderboard-screenshot-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';
import { db } from '@/firebase/server-init';

export async function POST(request: NextRequest) {
  try {
    const { serverId, channelId: rawChannelId } = await request.json();

    if (!serverId) {
      return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
    }

    // Resolve channel from dedicated channelMapping doc (keeps channel list clean)
    let channelId = (rawChannelId ?? '').trim();
    if (!channelId) {
      const mappingDoc = await db
        .collection('servers')
        .doc(serverId)
        .collection('config')
        .doc('channelMapping')
        .get();
      channelId = mappingDoc.data()?.leaderboard || '';
    }

    if (!channelId) {
      return NextResponse.json({ error: 'leaderboard channel not configured' }, { status: 400 });
    }

    console.log('[Leaderboard/Generate] Starting', { serverId, channelId });

    const dataUrl = await takeLeaderboardScreenshot(serverId);
    if (!dataUrl) {
      throw new Error('Failed to generate leaderboard screenshot');
    }

    const fileBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    const messageId = await sendDiscordMessage(channelId, {
      content: '**🚀 Space Mountain Leaderboard**',
      files: [{
        name: 'leaderboard.png',
        data: fileBase64,
        contentType: 'image/png',
      }],
    }, serverId);

    if (!messageId) {
      throw new Error('Failed to send leaderboard to Discord');
    }

    console.log('[Leaderboard/Generate] Completed', { serverId, channelId, messageId });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate/post leaderboard';
    console.error('[Leaderboard/Generate] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
