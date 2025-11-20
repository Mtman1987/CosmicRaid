import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      hasCredentialsJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      hasCredentialsPath: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      hasProjectId: !!(
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ),
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 
                process.env.GOOGLE_CLOUD_PROJECT || 
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                'not set',
      googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
      firebaseAdminProjectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'not set',
      nextPublicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set'
    };

    // Try to initialize Firebase Admin
    let dbTest = null;
    try {
      const { db } = await import('@/firebase/server-init');
      
      // Try a simple read operation
      const testDoc = await db.collection('test').doc('connection').get();
      dbTest = {
        canConnect: true,
        docExists: testDoc.exists,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      dbTest = {
        canConnect: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      environment: envCheck,
      database: dbTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}