'use server';

import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedShoutoutCycle } from '@/lib/automated-shoutout-system';

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();

    if (!serverId) {
      return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    // Run the cycle asynchronously without waiting.
    runAutomatedShoutoutCycle(serverId, { force: true }).catch(error => {
      console.error(`[Manual Dispatch] Unhandled error in background shoutout cycle for server ${serverId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Automated shoutout cycle triggered successfully. It will run in the background.',
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('[Manual Dispatch Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
