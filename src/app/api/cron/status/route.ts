import { NextResponse } from 'next/server';
import { runUnifiedCronCycle } from '@/lib/unified-cron-service';

export async function GET() {
  try {
    const result = await runUnifiedCronCycle();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      serversProcessed: 0,
      totalUsers: 0,
      apiCalls: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}