
'use server';

import { NextRequest, NextResponse } from 'next/server';

/**
 * This API route is being intentionally disabled as part of a diagnostic step.
 * The UI will now call the server action directly, removing this layer of abstraction
 * to isolate the source of a persistent error.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'This endpoint is temporarily disabled for diagnostic purposes.',
      message: 'Please trigger the shoutout cycle directly from the UI action.',
    },
    { status: 410 } // 410 Gone
  );
}
