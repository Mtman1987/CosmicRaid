import { NextRequest, NextResponse } from 'next/server';
import { takeLeaderboardScreenshot } from '@/lib/leaderboard-screenshot-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';
import { db, app } from '@/firebase/server-init';
import { getStorage } from 'firebase-admin/storage';
import { resolveServerIdFromRequest } from '@/lib/get-server-id';

export async function POST(request: NextRequest) {
  try {
    const { serverId: bodyServerId, channelId: rawChannelId } = await request.json();
    let serverId = bodyServerId;
    if (!serverId) {
      serverId = await resolveServerIdFromRequest(request) || undefined;
    }

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

    let dataUrl = await takeLeaderboardScreenshot(serverId);
    if (!dataUrl) {
      // Fallback: try FreeConvert/local flow from generateLeaderboardImage
      const { generateLeaderboardImage } = await import('@/ai/flows/generate-leaderboard-image');
      dataUrl = await generateLeaderboardImage(serverId);
      if (!dataUrl) {
        throw new Error('Failed to generate leaderboard screenshot');
      }
    }

    let imageUrl: string | null = null;
    let fileBase64: string | null = null;

    if (dataUrl.startsWith('http')) {
      imageUrl = dataUrl;
    } else {
      fileBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('No storage bucket configured to upload screenshot');
      }
      const buffer = Buffer.from(fileBase64, 'base64');
      const storage = getStorage(app);
      const bucket = storage.bucket(bucketName);
      const fileName = `leaderboard-images/${serverId}/leaderboard-${Date.now()}.png`;
      const file = bucket.file(fileName);
      await file.save(buffer, { metadata: { contentType: 'image/png' }, public: true });
      imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      fileBase64 = null;
    }

    const basePayload: any = {
      content: '**🚀 Space Mountain Leaderboard**',
    };

    basePayload.embeds = [{
      title: 'Space Mountain Leaderboard',
      image: { url: imageUrl },
      timestamp: new Date().toISOString(),
    }];
    // Optional attachment for clients that prefer files (Discord will still need multipart to truly attach)
    if (fileBase64) {
      basePayload.files = [{
        name: 'leaderboard.png',
        data: fileBase64,
        contentType: 'image/png',
      }];
    }

    console.log('[Leaderboard/Generate] Discord payload summary', {
      hasFile: !!fileBase64,
      hasEmbed: !!basePayload.embeds,
      imageUrl,
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
