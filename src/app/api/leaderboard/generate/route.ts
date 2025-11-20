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

    let fileBase64: string | null = null;

    if (dataUrl.startsWith('http')) {
      try {
        const imgResp = await fetch(dataUrl);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        fileBase64 = buf.toString('base64');
      } catch (err) {
        console.error('[Leaderboard/Generate] Failed to fetch image URL, will try sending as embed URL:', err);
      }
    } else {
      fileBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    }

    const basePayload: any = {
      content: '**🚀 Space Mountain Leaderboard**',
    };

    if (fileBase64) {
      basePayload.files = [{
        name: 'leaderboard.png',
        data: fileBase64,
        contentType: 'image/png',
      }];
    } else if (dataUrl.startsWith('http')) {
      basePayload.embeds = [{
        title: 'Space Mountain Leaderboard',
        image: { url: dataUrl },
        timestamp: new Date().toISOString(),
      }];
    } else {
      console.error('[Leaderboard/Generate] No file or imageUrl to send', { serverId, channelId, dataUrlSnippet: dataUrl?.slice?.(0, 50) });
      throw new Error('No image generated to send');
    }

    console.log('[Leaderboard/Generate] Discord payload summary', {
      hasFile: !!fileBase64,
      hasEmbed: !!basePayload.embeds,
      dataUrlSnippet: dataUrl?.slice?.(0, 50),
    });

    const messageId = await sendDiscordMessage(channelId, basePayload, serverId);

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
