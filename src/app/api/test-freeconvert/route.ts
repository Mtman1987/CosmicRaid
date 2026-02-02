'use server';

import { NextRequest, NextResponse } from 'next/server';
import { freeConvertService } from '@/lib/community-spotlight-serverside-fallback';
import { uploadToStorage } from '@/lib/firebase-storage-service';

export async function POST(request: NextRequest) {
  console.log('[TestFreeConvert] Received test request.');

  // Use a reliable, public stock footage URL for testing
  const testMp4Url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  try {
    console.log(`[TestFreeConvert] Starting conversion for stock footage: ${testMp4Url}`);
    const gifBuffer = await freeConvertService.convertVideoUrlToGif(testMp4Url, {
      width: 480, // Use a smaller width for faster testing
      fps: 12,
      duration: 10,
    });

    if (!gifBuffer) {
      throw new Error('GIF conversion process returned an empty buffer. This could be due to a misconfigured API key or an issue with the FreeConvert service.');
    }

    console.log(`[TestFreeConvert] Conversion successful, buffer size: ${gifBuffer.length}. Uploading to storage...`);

    const outputFilename = `test-gifs/test-conversion-${Date.now()}.gif`;
    const finalGifUrl = await uploadToStorage(gifBuffer, outputFilename, 'image/gif');

    console.log(`[TestFreeConvert] Test successful. GIF available at: ${finalGifUrl}`);

    return NextResponse.json({
      success: true,
      message: 'Test conversion was successful!',
      gifUrl: finalGifUrl,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred during the FreeConvert test.';
    console.error('[TestFreeConvert] Test failed:', error);
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
