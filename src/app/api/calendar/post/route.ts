import { NextRequest, NextResponse } from 'next/server';
import {
  uploadCalendarImageFromGenerator,
  buildCalendarButtons,
  storeCalendarMessageMeta,
  generateCalendarEmbeds,
} from '@/lib/calendar-discord-service';
import { db } from '@/firebase/server-init';
import { sendDiscordMessage } from '@/lib/discord-bot-service';

export async function POST(request: NextRequest) {
  try {
    const { serverId, channelId: rawChannelId, includeButtons = true } = await request.json();

    if (!serverId) {
      return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
    }

    // Resolve channel from config if not provided
    let channelId = (rawChannelId ?? '').trim();
    if (!channelId) {
      const channelDoc = await db
        .collection('servers')
        .doc(serverId)
        .collection('config')
        .doc('channels')
        .get();
      channelId = channelDoc.data()?.calendar || '';
    }

    if (!channelId) {
      return NextResponse.json({ error: 'calendar channel not configured' }, { status: 400 });
    }

    console.log('[Calendar/Post] Starting generation', { serverId, channelId, includeButtons });

    const monthOffset = 0;
    const imageUrl = await uploadCalendarImageFromGenerator(serverId, monthOffset);
    const { missionEmbed, calendarEmbed } = await generateCalendarEmbeds(serverId, imageUrl);

    // Send image first (without embed to prevent shrinking)
    const imageMessageId = await sendDiscordMessage(channelId, {
      content: imageUrl
    }, serverId);
    
    if (!imageMessageId) {
      throw new Error('Failed to post calendar image to Discord');
    }

    // Then send embeds with buttons (without image)
    const embedPayload: any = {
      embeds: [missionEmbed, calendarEmbed],
    };
    if (includeButtons) {
      embedPayload.components = buildCalendarButtons(serverId);
    }

    const messageId = await sendDiscordMessage(channelId, embedPayload, serverId);
    if (!messageId) {
      throw new Error('Failed to post calendar embed to Discord');
    }

    await storeCalendarMessageMeta(serverId, {
      channelId,
      messageId,
      includeButtons,
      lastImageUrl: imageUrl,
      monthOffset,
    });

    console.log('[Calendar/Post] Completed', { serverId, channelId, messageId });

    return NextResponse.json({ success: true, imageUrl, messageId, imageMessageId });
  } catch (error) {
    console.error('[Calendar/Post] Error:', error);
    return NextResponse.json({ error: 'Failed to generate/post calendar' }, { status: 500 });
  }
}
