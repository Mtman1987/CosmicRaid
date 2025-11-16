'use server';

import { NextRequest, NextResponse } from 'next/server';
import { postNewCalendar } from '@/lib/actions';

export async function POST(req: NextRequest) {
  // 1. Authenticate the request using the custom secret key
  const botSecret = req.headers.get('x-bot-secret');
  if (botSecret !== process.env.BOT_SECRET_KEY) {
    console.warn('[API /discord] Invalid or missing x-bot-secret');
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json();
    console.log('[API /discord] Received request body:', JSON.stringify(payload, null, 2));

    // 2. Validate the incoming payload structure
    const { root } = payload;
    if (!root) {
      return NextResponse.json({ status: 'error', message: 'Missing "root" object in payload.' }, { status: 400 });
    }

    const { feature, guildId, channelId, dispatch } = root;
    if (feature === undefined || guildId === undefined || channelId === undefined || dispatch === undefined) {
      const missingFields = ['feature', 'guildId', 'channelId', 'dispatch'].filter(f => root[f] === undefined);
      return NextResponse.json({ status: 'error', message: `Missing required fields in root object: ${missingFields.join(', ')}.` }, { status: 400 });
    }

    // 3. Handle the 'calendar' feature
    if (feature === 'calendar' && dispatch === true) {
      // Respond immediately to acknowledge the request
      const immediateResponse = NextResponse.json({
        status: 'success',
        message: 'Request acknowledged. Calendar generation initiated in the background.',
      });

      // --- Execute the slow task in the background (fire-and-forget) ---
      // We use a try...finally block to ensure the response is sent
      // even if the background task initiation has an issue.
      try {
        postNewCalendar(guildId, channelId)
          .then(() => console.log(`[API /discord] Background calendar post complete for guild: ${guildId}`))
          .catch((e) => console.error(`[API /discord] Background calendar post FAILED for guild: ${guildId}`, e));
      } finally {
        return immediateResponse;
      }
    }

    // Handle other features or invalid feature values
    if (feature !== 'calendar'){
      return NextResponse.json({ status: 'error', message: `Invalid or unhandled feature: ${feature}` }, { status: 400 });
    }
    
    // Handle cases where dispatch is not true
    if (dispatch !== true) {
        return NextResponse.json({ status: 'info', message: `Feature '${feature}' received but dispatch was not true. No action taken.` });
    }

    // Fallback for any unhandled cases
    return NextResponse.json({ status: 'error', message: 'Request could not be processed.' }, { status: 400 });

  } catch (error) {
    console.error('[API /discord] UNHANDLED ERROR:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error', details: errorMessage },
      { status: 500 }
    );
  }
}
