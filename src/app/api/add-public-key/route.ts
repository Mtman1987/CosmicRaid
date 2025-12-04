import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server-init';

export async function POST(request: NextRequest) {
  try {
    const serverId = '1240832965865635881';
    const publicKey = '6a903d0ec86d3d1556aeb2a7ec1dd585ab35e9129d040a8149cdfb8ad4154561';
    
    // Add to globalConfig
    await db.collection('globalConfig').doc('discordBot').set({
      DISCORD_PUBLIC_KEY: publicKey
    }, { merge: true });
    
    // Also add to server-specific secrets
    await db.collection('servers').doc(serverId).collection('config').doc('secrets').set({
      DISCORD_PUBLIC_KEY: publicKey
    }, { merge: true });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Discord Public Key added to Firestore',
      publicKey: publicKey
    });
    
  } catch (error) {
    console.error('Error adding public key:', error);
    return NextResponse.json({ 
      error: 'Failed to add public key' 
    }, { status: 500 });
  }
}