import { put } from '@vercel/blob';

export async function POST(request: Request) {

    // return new Response(JSON.stringify({ "success": true, "message": "Image uploaded successfully", "fileName": "89B887FB-CE3A-446B-AA62-223F1B5D226B.png", "fileSize": 2895814, "ImageType": "image/jpeg","blobUrl": "https://aft07xnw52tcy9ig.public.blob.vercel-storage.com/apple_89B887FB-CE3A-446B-AA62-223F1B5D226B.png", "blobDownloadUrl": "https://aft07xnw52tcy9ig.public.blob.vercel-storage.com/apple_89B887FB-CE3A-446B-AA62-223F1B5D226B.png?download=1" }), {
    //     headers: {
    //         'Content-Type': 'application/json'
    //     }
    // });

    try {
        const contentType = request.headers.get('content-type') || '';
        const fileName = request.headers.get('file-name') || '';
        console.log('Content-Type:', contentType);
        console.log('File name from header:', fileName);

        let file: File | null = null;
        let buffer: Buffer | null = null;

        // if (contentType.includes('multipart/form-data')) {
        //     // Handle multipart form data
        //     const formData = await request.formData();
        //     file = formData.get('file') as File;

        //     if (file) {
        //         const bytes = await file.arrayBuffer();
        //         buffer = Buffer.from(bytes);
        //     }
        // } else if (contentType.includes('application/json')) {
        //     // Handle JSON data (fallback)
        //     const body = await request.json();
        //     console.log('JSON body received:', body);

        //     return new Response(JSON.stringify({
        //         success: false,
        //         message: 'JSON data received, but file upload expected',
        //         receivedData: body
        //     }), {
        //         headers: {
        //             'Content-Type': 'application/json'
        //         }
        //     });
        // } 



        if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
            // Handle JPEG image data directly
            const arrayBuffer = await request.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);

            console.log('JPEG image data received, size:', buffer.length);
        } else {
            // Handle other raw binary data
            const arrayBuffer = await request.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);

            console.log('Raw binary data received, size:', buffer.length);
        }

        if (!buffer) {
            return new Response(JSON.stringify({
                success: false,
                message: 'No file data received'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // Generate filename if not provided
        const finalFileName = fileName || `image_${Date.now()}.jpg`;

        console.log('File/buffer received:', {
            name: finalFileName,
            size: buffer.length,
            type: contentType || 'unknown'
        });

        // Validate that we have image data
        if (buffer.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Empty file received'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // Validate JPEG format by checking file header
        // const isJPEG = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
        // const isPNG = buffer.length >= 8 &&
        //     buffer[0] === 0x89 && buffer[1] === 0x50 &&
        //     buffer[2] === 0x4E && buffer[3] === 0x47;

        // if (!isJPEG && !isPNG) {
        //     console.log('Warning: File may not be a valid image format');
        // }
        console.log("Uploading image to Vercal Blob ============================================================================= ");
        // 上传到Vercal Blob
        const blob = await put("apple_" + finalFileName, buffer, { access: 'public', addRandomSuffix: false, allowOverwrite: true });

        console.log('Blob URL:', blob.url);
        console.log('Blob Download URL:', blob.downloadUrl);
        console.log('Blob Pathname:', blob.pathname);
        console.log('Blob Buffer:', JSON.stringify({
            success: true,
            message: 'Image uploaded successfully',
            fileName: finalFileName,
            fileSize: buffer.length,
            contentType: contentType,
            blobUrl: blob.url,
            blobDownloadUrl: blob.downloadUrl
        }))
        return new Response(JSON.stringify({
            success: true,
            message: 'Image uploaded successfully',
            fileName: finalFileName,
            fileSize: buffer.length,
            ImageType: contentType,
            blobUrl: blob.url,
            blobDownloadUrl: blob.downloadUrl
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Upload failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
