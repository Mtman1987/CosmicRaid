'use server';

import { NextRequest, NextResponse } from 'next/server';
import { postNewCalendar } from '@/lib/actions';

export async function POST(req: NextRequest) {
  try {
    const { serverId, channelId } = await req.json();

    if (!serverId || !channelId) {
      return NextResponse.json({ error: 'Server ID and Channel ID are required.' }, { status: 400 });
    }

    const result = await postNewCalendar(serverId, channelId);

    if (!result.success) {
      throw new Error(result.message);
    }

    return NextResponse.json({ message: 'Calendar successfully dispatched to Discord.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('[Dispatch Calendar Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
