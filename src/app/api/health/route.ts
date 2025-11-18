import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Cosmic Raid Local Services',
    timestamp: new Date().toISOString(),
    capabilities: [
      'local-screenshots',
      'local-conversion', 
      'gif-processing',
      'media-optimization'
    ]
  });
}