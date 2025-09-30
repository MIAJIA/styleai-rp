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

// Concise style prompts optimized for image generation
const STYLE_PROMPTS = {
    'Casual': 'Relaxed everyday style with neutral colors, soft cotton/denim, comfortable fits, basic pieces, minimal accessories.',
    
    'Classy': 'Elegant sophisticated style with classic neutrals, premium fabrics (silk, wool, cashmere), tailored fits, blazers, pearls, timeless luxury.',
    
    'Old Money': 'Quiet luxury with rich neutrals, cashmere/tweed, classic tailoring, cable knits, loafers, heritage pieces, no logos.',
    
    'Preppy': 'Collegiate Ivy League style with navy/white/bright colors, oxford shirts, cable knits, chinos, boat shoes, pearls, clean structured fits.',
    
    'Coastal': 'Breezy beach style with ocean blues/sandy beiges, airy linen/cotton, flowing relaxed fits, straw accessories, effortless summer vibe.',
    
    'Boho': 'Free-spirited bohemian with earthy tones, flowing fabrics, layered maxi pieces, fringe, ethnic patterns, festival-ready artistic vibe.',
    
    'Coquette': 'Romantic feminine with soft pastels, lace/silk, bows, mini dresses, ballet flats, pearls, dainty details, sweet Parisian balletcore.',
    
    'Edgy': 'Bold rebellious style with black/dark colors, leather, distressed denim, asymmetric cuts, combat boots, studs, chains, rock aesthetic.',
    
    'Sporty': 'Athletic athleisure with bold colors/neon, technical fabrics, fitted flexible cuts, sneakers, leggings, hoodies, performance-ready active vibe.',
    
    'Streetstyle': 'Urban trendy with bold colors/graphics, mixed proportions, oversized hoodies, statement sneakers, cargo pants, hip-hop skate culture.',
    
    'Dopamine': 'Mood-boosting maximalist with vibrant saturated colors (hot pink, electric blue, yellow), bold playful pieces, joyful energetic expression.',
    
    'Y2K': 'Early 2000s nostalgic with metallics/holographic, velour, low-rise, crop tops, platform shoes, tiny sunglasses, Paris Hilton era.'
};

export async function POST(request: NextRequest) {
    try {
        const body: ImageGenerationRequest = await request.json();
        const {
            userId,
            imageUrl,
            styleOptions,
            prompt,
            maxTokens = 2000,
            temperature = 0.8
        } = body;

        console.log(`[NewGen API] Processing image generation request`);
        console.log(`[NewGen API] Image URL: ${imageUrl?.substring(0, 100)}...`);
        console.log(`[NewGen API] Style options: ${styleOptions}`);

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

            customPrompt = `Transform the outfit image into ${styleOptions.length} distinct style variations:

${styleDescriptions}

For each style:
- Apply its specific colors, fabrics, and silhouettes
- Add characteristic accessories and details
- Make it visually distinct and recognizable
- Keep professional, polished, fashion-magazine quality

Generate ${styleOptions.length} complete, wearable styled images.`;
        }
        console.log(`[NewGen API] Custom prompt length: ${customPrompt.length}`);
        // Generate styled images
        const generatedImages = await generateStyledImagesWithGemini({
            userId,
            imageUrl,
            styleOptions,
            prompt: customPrompt,
            maxOutputTokens: maxTokens,
            temperature,
        });

        console.log(`[NewGen API] Generated ${generatedImages.length} images successfully`);


        return NextResponse.json({
            success: true,
            message: "Image generation completed",
            data: {
                images: generatedImages,
                styleOptions: styleOptions,
                numImages: generatedImages.length,
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
