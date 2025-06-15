import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing image URL', { status: 400 });
  }

  try {
    // Fetch the image from the insecure URL
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new NextResponse('Failed to fetch image', { status: imageResponse.status });
    }

    // Get the raw image data as a blob
    const imageBlob = await imageResponse.blob();
    const headers = new Headers();

    // Set the content type to the one from the original response
    headers.set('Content-Type', imageResponse.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');


    // Return a new response with the image data and correct headers
    return new NextResponse(imageBlob, { status: 200, headers });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Error proxying image', { status: 500 });
  }
}