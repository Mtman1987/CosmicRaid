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
    const imageUrl = await uploadCalendarImageFromGenerator(serverId, monthOffset);
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
    const messagePayload: any = {
      embeds: [missionEmbed, calendarEmbed],
    };

    if (includeButtons) {
      messagePayload.components = buildCalendarButtons(serverId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://localhost:3000' : 'http://localhost:3000');
    const discordResponse = await fetch(`${baseUrl}/api/discord/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        embeds: [missionEmbed, calendarEmbed],
        components: includeButtons ? buildCalendarButtons(serverId) : undefined,
      }),
    });

    if (!discordResponse.ok) {
      throw new Error('Failed to post to Discord');
    }

    const result = await discordResponse.json();

    await storeCalendarMessageMeta(serverId, {
      channelId,
      messageId: result.id,
      includeButtons,
      lastImageUrl: imageUrl,
      monthOffset,
    });

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Calendar generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
