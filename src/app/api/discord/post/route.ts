import { NextRequest, NextResponse } from 'next/server';
import { getDiscordBotToken } from '@/lib/discord-bot-token';

export async function POST(request: NextRequest) {
  try {
    const { channelId, content, embeds, components } = await request.json();
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    // Try Firestore globalConfig first, then env fallback
    const botToken = await getDiscordBotToken();
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        embeds,
        components,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Discord API error:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, messageId: result.id });

  } catch (error) {
    console.error('Discord post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
