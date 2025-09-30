import { generateStyledImagesWithGemini } from "@/lib/apple/gemini";
import { NextRequest, NextResponse } from 'next/server';

interface ImageGenerationRequest {
    userId: string;
    imageUrl: string;
    styleOptions: string[];
    prompt?: string;
    numImages?: number;
    maxTokens?: number;
    temperature?: number;
}

// Available style options
const AVAILABLE_STYLES = [
    'Casual', 'Classy', 'Old Money', 'Preppy', 'Coastal', 'Boho', 'Coquette', 'Edgy', 'Sporty', 'Streetstyle', 'Dopamine', 'Y2K',
];

// Default prompts for different styles
const STYLE_PROMPTS = {
    'Casual': 'Create a relaxed, comfortable everyday look with effortless style. Focus on natural fabrics, relaxed fits, and easy-to-wear pieces.',
    'Classy': 'Design an elegant, sophisticated outfit with timeless appeal. Emphasize quality materials, refined cuts, and understated luxury.',
    'Old Money': 'Create a wealthy, established aesthetic with high-end pieces, classic silhouettes, and subtle luxury details. Think quality over trends.',
    'Preppy': 'Design a clean, collegiate-inspired look with structured pieces, classic patterns, and polished details. Think Ivy League style.',
    'Coastal': 'Create a breezy, beach-inspired look with light fabrics, nautical elements, and relaxed summer vibes.',
    'Boho': 'Design a free-spirited, artistic look with flowing fabrics, eclectic patterns, and bohemian accessories.',
    'Coquette': 'Create a feminine, romantic look with delicate details, soft fabrics, and playful, flirty elements.',
    'Edgy': 'Design a bold, alternative look with dark colors, statement pieces, and rebellious styling elements.',
    'Sporty': 'Create an athletic, active look with performance fabrics, comfortable fits, and athletic-inspired styling.',
    'Streetstyle': 'Design a trendy, urban look with bold pieces, statement accessories, and contemporary street fashion elements.',
    'Dopamine': 'Create a bright, cheerful look with vibrant colors, fun patterns, and mood-boosting styling elements.',
    'Y2K': 'Design a nostalgic, early 2000s inspired look with metallic details, bold colors, and retro-futuristic elements.'
};

export async function POST(request: NextRequest) {
    try {
        const body: ImageGenerationRequest = await request.json();
        const {
            userId,
            imageUrl,
            styleOptions,
            prompt,
            numImages = 3,
            maxTokens = 2000,
            temperature = 0.8
        } = body;

        console.log(`[NewGen API] Processing image generation request`);
        console.log(`[NewGen API] Image URL: ${imageUrl?.substring(0, 100)}...`);
        console.log(`[NewGen API] Style options: ${styleOptions}`);
        console.log(`[NewGen API] Number of images: ${numImages}`);

        if (!imageUrl) {
            return NextResponse.json({
                error: 'imageUrl is required'
            }, { status: 400 });
        }

        if (!styleOptions || styleOptions.length === 0) {
            return NextResponse.json({
                error: 'styleOptions are required'
            }, { status: 400 });
        }

        // Validate style options
        const invalidStyles = styleOptions.filter(style => !AVAILABLE_STYLES.includes(style));
        if (invalidStyles.length > 0) {
            return NextResponse.json({
                error: `Invalid style options: ${invalidStyles.join(', ')}`,
                availableStyles: AVAILABLE_STYLES
            }, { status: 400 });
        }

        // Build custom prompt based on selected styles
        let customPrompt = prompt;
        if (!customPrompt) {
            const styleDescriptions = styleOptions.map(style =>
                `${style}: ${STYLE_PROMPTS[style as keyof typeof STYLE_PROMPTS] || 'Create a stylish look.'}`
            ).join('\n\n');

            customPrompt = `Generate ${numImages} different styled outfit variations based on the uploaded image. Each image should showcase a different style interpretation while maintaining the core outfit structure.

Style Guidelines:
${styleDescriptions}

Focus on: color variations, accessory changes, styling details, and overall aesthetic differences. Make each image unique and fashionable while staying true to the selected style aesthetic.`;
        }
        let images = [];
        for (let i = 0; i < numImages; i++) {
            // Generate styled images
            const generatedImages = await generateStyledImagesWithGemini({
                userId,
                imageUrl,
                styleOptions,
                prompt: customPrompt,
                numImages,
                maxOutputTokens: maxTokens,
                temperature,
            });
    
            console.log(`[NewGen API] Generated ${generatedImages.length} images successfully`);
            images.push(...generatedImages);
        }
        console.log(`[NewGen API] Generated ${images.length} images successfully`);

        return NextResponse.json({
            success: true,
            message: "Image generation completed",
            data: {
                images: images,
                styleOptions: styleOptions,
                numImages: images.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[NewGen API] Error processing image generation:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to generate images',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET - Get available style options
export async function GET(request: NextRequest) {
    try {
        return NextResponse.json({
            success: true,
            message: "Available style options",
            data: {
                styles: AVAILABLE_STYLES,
                stylePrompts: STYLE_PROMPTS,
                categories: {
                    'Classic': ['Classy', 'Old Money', 'Preppy'],
                    'Casual': ['Casual', 'Coastal', 'Sporty'],
                    'Creative': ['Boho', 'Edgy', 'Streetstyle'],
                    'Feminine': ['Coquette', 'Dopamine'],
                    'Trendy': ['Y2K']
                },
                usage: {
                    description: "Select one or more style options to generate styled outfit variations",
                    example: {
                        imageUrl: "https://example.com/outfit.jpg",
                        styleOptions: ["Casual", "Classy", "Boho"],
                        numImages: 3
                    },
                    note: "Each style comes with a default prompt that defines its aesthetic. You can override with a custom prompt if needed."
                }
            }
        });

    } catch (error) {
        console.error('[NewGen API] Error fetching style options:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch style options'
        }, { status: 500 });
    }
}
