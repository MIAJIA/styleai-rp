import { analyzeImageWithGemini } from "@/lib/apple/gemini";
import { NextRequest, NextResponse } from 'next/server';



// 对用户上传的图片进行分析
export async function POST(request: NextRequest) {
    try {


        const contentType = request.headers.get('content-type') || '';
        const fileName = request.headers.get('file-name') || '';
        const userId = request.headers.get('user-id') || '';
        const analysisType = request.headers.get('analysisType') || '';
        console.log('Content-Type:', contentType);
        console.log('File name from header:', fileName);


        console.log(`[Gemini API] Processing image analysis request`);

        // Set different prompts based on analysis type
        let analysisPrompt = '';
        if (!analysisPrompt) {
            switch (analysisType) {
                case 'fashion':
                    analysisPrompt = `Please analyze the outfit style in this image, including:
1. Clothing type and style (formal, casual, trendy, etc.)
2. Color coordination analysis
3. Overall styling strengths and weaknesses
4. Improvement suggestions and styling advice
5. Suitable occasions
Please respond in English with a professional and friendly tone.`;
                    break;
                case 'detailed':
                    analysisPrompt = `Please provide a detailed analysis of the outfit in this image, including:
1. Individual clothing item analysis (tops, bottoms, shoes, accessories, etc.)
2. Color coordination and proportion analysis
3. Style positioning and fashion elements
4. Body type characteristics and styling effects
5. Overall outfit strengths and weaknesses
6. Specific improvement suggestions
7. Suitable occasions and seasons
8. Suggestions for pairing with other items
Please respond in English with professional and practical advice.`;
                    break;
                case 'general':
                default:
                    analysisPrompt = `Please analyze the outfit in this image and provide concise evaluation and suggestions.`;
                    break;
            }
        }

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
        const analysisResult = await analyzeImageWithGemini(userId, analysisPrompt, imageBase64, 'image/jpeg');

        console.log(`[Gemini API] Analysis completed successfully`);

        return NextResponse.json({
            success: true,
            message: analysisResult.texts[0],
            image: analysisResult.images[0]
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