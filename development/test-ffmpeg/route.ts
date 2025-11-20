import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing local conversion service availability...');
    
    const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL || 'http://localhost:3300';
    
    // Test local service health
    const healthResponse = await fetch(`${localServiceUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!healthResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Local conversion service not available',
        details: `Service at ${localServiceUrl} returned ${healthResponse.status}`
      });
    }
    
    const healthData = await healthResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Local conversion service working correctly!',
      serviceUrl: localServiceUrl,
      serviceStatus: healthData
    });
    
  } catch (error) {
    console.error('Local service test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Local service test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}