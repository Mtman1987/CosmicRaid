import { NextRequest, NextResponse } from 'next/server';
import {
  uploadCalendarImageFromGenerator,
  buildCalendarButtons,
  storeCalendarMessageMeta,
  generateCalendarEmbeds,
} from '@/lib/calendar-discord-service';

export async function POST(request: NextRequest) {
  try {
    const { serverId, channelId, includeButtons = true, postToDiscord = true } = await request.json();

    if (!serverId) {
      return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
    }

    const monthOffset = 0;
    console.log(`[CalendarAPI] Generating calendar for server ${serverId}, channel ${channelId}`);
    
    const imageUrl = await uploadCalendarImageFromGenerator(serverId, monthOffset);
    if (!imageUrl) {
      throw new Error('Failed to generate calendar image. Please check that the calendar page is accessible.');
    }
    
    console.log(`[CalendarAPI] Image ready: ${imageUrl}`);
    const { missionEmbed, calendarEmbed } = await generateCalendarEmbeds(serverId, imageUrl);

    // If not posting to Discord, just return the generated data
    if (!postToDiscord || !channelId) {
      return NextResponse.json({ 
        success: true, 
        imageUrl,
        embeds: [missionEmbed, calendarEmbed],
        components: includeButtons ? buildCalendarButtons(serverId) : undefined
      });
    }

    // Post to Discord
    console.log(`[CalendarAPI] Posting to Discord channel ${channelId}`);
    
    const { sendDiscordMessage } = await import('@/lib/discord-bot-service');
    
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
    
    console.log('[CalendarAPI] Successfully posted to Discord');

    await storeCalendarMessageMeta(serverId, {
      channelId,
      messageId,
      includeButtons,
      lastImageUrl: imageUrl,
      monthOffset,
    });

    return NextResponse.json({ success: true, messageId, imageMessageId });
  } catch (error) {
    console.error('Calendar generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
