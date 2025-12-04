import { NextRequest, NextResponse } from 'next/server';
import { updateUserActivity } from '@/lib/user-server-mapping';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await updateUserActivity(userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}