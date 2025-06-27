import { NextResponse } from 'next/server';
import { saveImageVote, getImageVote, removeImageVote, getBatchImageVotes } from '@/lib/image-vote';

// POST /api/image-vote - Saves or updates an image vote
export async function POST(request: Request) {
  try {
    const { imageUrl, voteType, sessionId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }
    if (voteType && !['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    await saveImageVote(imageUrl, voteType, sessionId);

    return NextResponse.json({
      success: true,
      message: voteType ? `Image ${voteType}d successfully` : 'Vote removed successfully'
    });
  } catch (error) {
    console.error('[API-ImageVote-POST] Error:', error);
    return NextResponse.json({ error: 'Failed to save image vote' }, { status: 500 });
  }
}

// GET /api/image-vote - Retrieves image vote status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');
    const imageUrlsParam = searchParams.get('imageUrls');

    if (imageUrlsParam) {
      const urlList = JSON.parse(imageUrlsParam);
      const voteMap = await getBatchImageVotes(urlList);
      const voteObject = Object.fromEntries(voteMap);
      return NextResponse.json({ success: true, votes: voteObject });
    }

    if (imageUrl) {
      const vote = await getImageVote(imageUrl);
      return NextResponse.json({ success: true, vote });
    }

    return NextResponse.json({ error: 'Image URL or URLs required' }, { status: 400 });

  } catch (error) {
    console.error('[API-ImageVote-GET] Error:', error);
    return NextResponse.json({ error: 'Failed to get image vote' }, { status: 500 });
  }
}

// DELETE /api/image-vote - Removes an image vote
export async function DELETE(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    await removeImageVote(imageUrl);

    return NextResponse.json({
      success: true,
      message: 'Vote removed successfully'
    });
  } catch (error) {
    console.error('[API-ImageVote-DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to remove image vote' }, { status: 500 });
  }
}