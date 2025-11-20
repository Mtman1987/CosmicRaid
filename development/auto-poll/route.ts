import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { runUnifiedCronCycle } = await import('@/lib/unified-cron-service');
    const result = await runUnifiedCronCycle();
    
    return NextResponse.json({ 
      success: result.success,
      message: `Processed ${result.serversProcessed} servers, ${result.totalUsers} users`,
      details: result
    });
  } catch (error) {
    console.error('Error running unified cron:', error);
    return NextResponse.json({ 
      error: 'Failed to run unified cron cycle',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return POST(new NextRequest('http://localhost/api/auto-poll', { method: 'POST' }));
}