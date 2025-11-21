import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server-init';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = '4c4808c4-f90b-4c8a-ae48-ce6818a3045e';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('freeconvert-signature');
    
    // Validate HMAC signature
    const expectedSignature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    console.log('[FreeConvert Webhook] Headers:', Object.fromEntries(request.headers.entries()));
    console.log('[FreeConvert Webhook] Body:', body);
    console.log('[FreeConvert Webhook] Parsed:', JSON.stringify(payload, null, 2));
    
    const { id: jobId, status, tasks } = payload;
    
    if (status === 'completed') {
      const exportTask = Object.values(tasks).find((task: any) => task.operation === 'export/url');
      const imageUrl = exportTask?.result?.files?.[0]?.url;
      
      if (imageUrl) {
        await db.collection('freeconvert-jobs').doc(jobId).set({
          status: 'completed',
          imageUrl,
          completedAt: new Date()
        });
        
        console.log('[FreeConvert Webhook] Job completed:', jobId, imageUrl);
      }
    } else if (status === 'failed') {
      await db.collection('freeconvert-jobs').doc(jobId).set({
        status: 'failed',
        error: payload.error || 'Unknown error',
        completedAt: new Date()
      });
      
      console.log('[FreeConvert Webhook] Job failed:', jobId);
    }
    
    return NextResponse.json({ success: true, received: payload });
  } catch (error) {
    console.error('[FreeConvert Webhook] Error:', error);
    console.error('[FreeConvert Webhook] Raw body:', await request.text().catch(() => 'Unable to read'));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}