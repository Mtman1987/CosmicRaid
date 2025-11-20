import { NextRequest, NextResponse } from 'next/server';
import {
  uploadCalendarImageFromGenerator,
  generateCalendarEmbeds,
  buildCalendarButtons,
  storeCalendarMessageMeta,
} from '@/lib/calendar-discord-service';

export async function POST(request: NextRequest) {
  try {
    const { serverId, channelId } = await request.json();
    
    if (!serverId || !channelId) {
      return NextResponse.json({ error: 'Server ID and Channel ID are required' }, { status: 400 });
    }

    const monthOffset = 0;
    const imageUrl = await uploadCalendarImageFromGenerator(serverId, monthOffset);
    const { missionEmbed, calendarEmbed } = await generateCalendarEmbeds(serverId, imageUrl);
    const components = buildCalendarButtons(serverId);

    // Post to Discord
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://localhost:3000' : 'http://localhost:3000');
    const discordResponse = await fetch(`${baseUrl}/api/discord/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        embeds: [missionEmbed, calendarEmbed],
        components,
      }),
    });

    if (!discordResponse.ok) {
      throw new Error('Failed to post to Discord');
    }

    const result = await discordResponse.json();

    await storeCalendarMessageMeta(serverId, {
      channelId,
      messageId: result.id,
      includeButtons: true,
      lastImageUrl: imageUrl,
      monthOffset,
    });

    return NextResponse.json({ success: true, messageId: result.id });

  } catch (error) {
    console.error('Calendar post error:', error?.message?.replace(/[\r\n]/g, '') || 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
