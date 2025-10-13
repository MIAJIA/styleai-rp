import { analyzeImageWithGemini } from "@/lib/apple/gemini";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from 'next/server';


const systemPrompt = `You are Styla, a stylist and fashion expert. Your goal is to analyze the user's outfit in the uploaded photo, and provide personalized and practical styling advice.
You have deep knowledge of fashion styling, color theory, silhouette balance, layering rules, and aesthetics.
Analyze the user's current outfit in the photo, identify what works well for the user and what could be improved. Give styling recommendation to elevate the look and generate image preview. Keep the user's original outfit as the foundation, and optimize around it. Refine layering and proportions through styling adjustments, add layering pieces if necessary, style with handbag, shoes and accessories for balance, and suggest suitable hairstyle or makeup to complete the look.
Summarize recommendation in one sentence within 50 words. Always reply clearly and concisely in a friendly and encouraging tone. 
At the end of each response, suggest the next actions the user might want to take. Keep the suggestions short, relevant and phrased as friendly questions. `;


// 对用户上传的图片进行分析
export async function POST(request: NextRequest) {
    try {


        const contentType = request.headers.get('content-type') || '';
        const fileName = request.headers.get('file-name') || '';
        const userId = request.headers.get('user-id') || '';
        const analysisType = request.headers.get('analysisType') || 'fashion';
        console.log('Content-Type:', contentType);
        console.log('File name from header:', fileName);
        console.log(`[Gemini API] Processing image analysis request`);

        const arrayBuffer = await request.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log('JPEG image data received, size:', buffer.length);
        
        // 将buffer转换为base64字符串
        const imageBase64 = buffer.toString('base64');
        console.log('Image converted to base64, length:', imageBase64.length);
        
        
        // 验证图片数据
        if (!imageBase64 || imageBase64.length < 100) {
            return NextResponse.json({ 
                error: 'Invalid image data - too small or empty' 
            }, { status: 400 });
        }
        
        // 调用Gemini进行图片分析
        const analysisResult = await analyzeImageWithGemini(userId, systemPrompt, imageBase64, 'image/jpeg');
        
        console.log(`[Gemini API] Analysis completed successfully`);
        
        const blob = await put(`app/users/${userId}/gemini_${fileName}`, buffer, {
            access: 'public',
            addRandomSuffix: false
        });
        return NextResponse.json({
            success: true,
            message: analysisResult.texts[0],
            image: analysisResult.images[0],
            uploadedImage: blob.url
        });

    } catch (error) {
        console.error('[Gemini API] Error processing image analysis:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to analyze image',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET - 获取分析类型说明
export async function GET(request: NextRequest) {
    try {
        const analysisTypes = {
            fashion: {
                name: 'Fashion Outfit Analysis',
                description: 'Professional fashion outfit analysis including style, color coordination, and styling advice',
                features: ['Clothing style analysis', 'Color coordination', 'Styling suggestions', 'Occasion recommendations']
            },
            detailed: {
                name: 'Detailed Outfit Analysis',
                description: 'Comprehensive outfit analysis including individual item analysis, body type characteristics, and specific recommendations',
                features: ['Individual item analysis', 'Body type analysis', 'Specific improvement suggestions', 'Styling recommendations']
            },
            general: {
                name: 'Basic Outfit Analysis',
                description: 'Concise outfit evaluation and suggestions',
                features: ['Basic evaluation', 'Simple suggestions']
            }
        };

        return NextResponse.json({
            success: true,
            message: "Available analysis types",
            data: analysisTypes
        });

    } catch (error) {
        console.error('[Gemini API] Error fetching analysis types:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch analysis types'
        }, { status: 500 });
    }
}