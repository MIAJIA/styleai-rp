import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Use edge runtime for faster response (optional)

export async function POST(req: NextRequest) {
  // Parse multipart form data
  const formData = await req.formData();
  const image = formData.get('image') as File | null;
  if (!image) {
    return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
  }

  // Prepare form data for external API
  const externalFormData = new FormData();
  externalFormData.append('image', image, image.name);

  // Add any other required fields for the external API here
  // externalFormData.append('otherField', 'value');

  // Call the external tryon API
  const apiRes = await fetch('https://app.klingai.com/global/dev/document-api/apiReference/model/functionalityTry', {
    method: 'POST',
    body: externalFormData,
    // If the API requires authentication, add headers here
    // headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  });

  if (!apiRes.ok) {
    const error = await apiRes.text();
    return NextResponse.json({ error }, { status: apiRes.status });
  }

  // Forward the response from the external API
  const result = await apiRes.json();
  return NextResponse.json(result);
}
