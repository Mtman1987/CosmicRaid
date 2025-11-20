import { NextRequest, NextResponse } from 'next/server';
import { awardPoints, type PointsEventType, PointsService } from '@/lib/points-service';

interface PointsUpdatePayload {
  serverId?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  eventType?: PointsEventType;
  points?: number; // Direct points (can be negative for subtraction)
  quantity?: number;
  source?: 'twitch' | 'discord' | 'manual';
  metadata?: Record<string, unknown>;
}

function jsonResponse(
  body: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, init);
}

export async function POST(req: NextRequest) {
  // Check authorization
  const secret = process.env.POINTS_SERVICE_SECRET;
  const botSecret = process.env.BOT_SECRET_KEY;
  const authHeader = req.headers.get('authorization');
  const serviceSecret = req.headers.get('x-service-secret');
  
  const isAuthorized = 
    (secret && serviceSecret === secret) ||
    (botSecret && authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] === botSecret);
    
  if (!isAuthorized) {
    return jsonResponse(
      { status: 'error', message: 'Unauthorized request.' },
      { status: 401 },
    );
  }

  let payload: PointsUpdatePayload;
  try {
    payload = (await req.json()) as PointsUpdatePayload;
  } catch (error) {
    console.error('[points/update] Failed to parse JSON payload:', error);
    return jsonResponse(
      { status: 'error', message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const { serverId, userId, username, displayName, eventType, points, quantity, source, metadata } = payload;

  // Direct points update (add/subtract)
  if (points !== undefined && userId && username) {
    if (!userId || !username) {
      return jsonResponse(
        { status: 'error', message: 'userId and username are required for direct points update.' },
        { status: 400 },
      );
    }

    try {
      const pointsService = PointsService.getInstance();
      const updatedUser = points > 0 
        ? await pointsService.addPoints(userId, username, displayName || username, points)
        : await pointsService.subtractPoints(userId, Math.abs(points));
      
      return jsonResponse({
        status: 'success',
        user: updatedUser,
        message: `${points > 0 ? 'Added' : 'Subtracted'} ${Math.abs(points)} points ${points > 0 ? 'to' : 'from'} ${displayName || username}. New total: ${updatedUser?.points || 'unknown'}`
      });
    } catch (error) {
      console.error('[points/update] Direct points update failed:', error);
      return jsonResponse(
        { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 },
      );
    }
  }

  // Event-based points update
  if (!serverId || !userId || !eventType) {
    return jsonResponse(
      {
        status: 'error',
        message: 'Missing required fields. Expecting `serverId`, `userId`, and `eventType` for event-based updates, or `userId`, `username`, and `points` for direct updates.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await awardPoints({
      serverId,
      userId,
      eventType,
      quantity: typeof quantity === 'number' && quantity > 0 ? quantity : 1,
      source,
      metadata,
    });

    return jsonResponse(
      {
        status: 'success',
        pointsAwarded: result.pointsAwarded,
        settings: result.settingsSnapshot,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[points/update] Failed to award points:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown server error';
    return jsonResponse(
      {
        status: 'error',
        message,
      },
      { status: 500 },
    );
  }
}
