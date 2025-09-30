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

// Enhanced prompts for different styles with detailed visual guidelines
const STYLE_PROMPTS = {
    'Casual': `**Casual Style**: Create a relaxed, effortlessly comfortable everyday look.
    - Colors: Neutral tones (beige, white, grey, navy, olive), soft earth tones
    - Fabrics: Soft cotton, denim, linen, jersey knits
    - Silhouettes: Relaxed fits, straight cuts, oversized but not baggy
    - Key Pieces: Classic jeans, basic tees, comfortable sweaters, sneakers, simple jackets
    - Accessories: Minimal - watch, simple bag, baseball cap
    - Vibe: Understated, comfortable, practical yet stylish`,
    
    'Classy': `**Classy Style**: Design an elegant, sophisticated outfit with timeless appeal.
    - Colors: Classic neutrals (black, navy, camel, ivory, burgundy), monochromatic schemes
    - Fabrics: Premium materials - wool, silk, cashmere, quality cotton, leather
    - Silhouettes: Tailored, well-fitted, structured yet feminine/masculine
    - Key Pieces: Blazers, pencil skirts, tailored trousers, elegant dresses, quality shoes
    - Accessories: Pearl jewelry, leather handbags, classic watches, minimal gold/silver
    - Vibe: Refined, polished, understated luxury, timeless elegance`,
    
    'Old Money': `**Old Money Style**: Create a wealthy, establishment aesthetic with quiet luxury.
    - Colors: Rich neutrals (navy, forest green, burgundy, camel, cream), subtle plaids
    - Fabrics: Luxurious natural fibers - cashmere, merino wool, silk, fine cotton, tweed
    - Silhouettes: Classic, conservative cuts, perfect tailoring, heritage styles
    - Key Pieces: Cable knit sweaters, polo shirts, blazers, loafers, riding boots, trench coats
    - Accessories: Heritage watches, leather goods, scarves, minimal but expensive jewelry
    - Vibe: Understated wealth, old-world elegance, inherited taste, quality over logos`,
    
    'Preppy': `**Preppy Style**: Design a clean, collegiate-inspired look with polished details.
    - Colors: Navy, white, red, kelly green, yellow, pink - bright and crisp
    - Fabrics: Oxford cotton, khaki, seersucker, madras, cable knit
    - Silhouettes: Clean lines, structured, well-fitted, neat and tidy
    - Key Pieces: Button-down shirts, sweater vests, pleated skirts, chinos, boat shoes, blazers
    - Accessories: Headbands, pearls, canvas belts, monogrammed items, satchels
    - Vibe: Ivy League, nautical influence, sporty but refined, youthful energy`,
    
    'Coastal': `**Coastal Style**: Create a breezy, beach-inspired look with relaxed summer vibes.
    - Colors: Ocean blues, sandy beiges, coral, seafoam green, white, sun-bleached tones
    - Fabrics: Light and airy - linen, cotton, chambray, breathable knits
    - Silhouettes: Flowing, relaxed, easy-wearing, loose and comfortable
    - Key Pieces: Linen shirts, maxi dresses, straw hats, sandals, light cardigans, shorts
    - Accessories: Straw bags, shell jewelry, sunglasses, espadrilles, canvas totes
    - Vibe: Relaxed vacation mode, sun-kissed, effortless beach elegance`,
    
    'Boho': `**Boho Style**: Design a free-spirited, artistic look with bohemian flair.
    - Colors: Earthy tones, terracotta, mustard, burgundy, olive, mixed prints
    - Fabrics: Natural fibers, flowing fabrics, crochet, embroidered details, fringe
    - Silhouettes: Loose, flowing, layered, maxi lengths, oversized
    - Key Pieces: Maxi skirts, peasant tops, kimonos, wide-leg pants, ankle boots, floppy hats
    - Accessories: Layered jewelry, fringe bags, headbands, statement rings, ethnic patterns
    - Vibe: Free-spirited, artistic, eclectic, festival-ready, globally-inspired`,
    
    'Coquette': `**Coquette Style**: Create a feminine, romantic look with delicate playful details.
    - Colors: Soft pastels (pink, lavender, baby blue), white, cream, rose gold
    - Fabrics: Lace, silk, satin, chiffon, organza, delicate knits
    - Silhouettes: Fitted bodices, A-line skirts, cinched waists, mini lengths, bows
    - Key Pieces: Mini dresses, ballet flats, cardigans, pleated skirts, ribbon details, ruffles
    - Accessories: Pearl jewelry, dainty necklaces, hair bows, mary janes, small handbags
    - Vibe: Romantic, playful, sweet, Parisian girl, balletcore, soft femininity`,
    
    'Edgy': `**Edgy Style**: Design a bold, alternative look with rebellious styling.
    - Colors: Black dominant, charcoal, deep reds, metallics, stark contrasts
    - Fabrics: Leather, faux leather, distressed denim, mesh, studs, chains
    - Silhouettes: Sharp cuts, asymmetric, oversized outerwear, fitted underneath
    - Key Pieces: Leather jackets, ripped jeans, combat boots, band tees, studded accessories
    - Accessories: Chunky boots, chokers, dark sunglasses, statement belts, silver jewelry
    - Vibe: Rock-inspired, rebellious, dark aesthetic, alternative, bold confidence`,
    
    'Sporty': `**Sporty Style**: Create an athletic, active look with performance elements.
    - Colors: Bold primary colors, black, white, neon accents, color blocking
    - Fabrics: Technical fabrics, moisture-wicking, stretch materials, mesh panels
    - Silhouettes: Fitted but flexible, streamlined, functional, athletic cuts
    - Key Pieces: Leggings, joggers, hoodies, sneakers, windbreakers, sports bras, track pants
    - Accessories: Athletic sneakers, baseball caps, backpacks, sports watches, gym bags
    - Vibe: Athleisure, performance-ready, energetic, health-conscious, active lifestyle`,
    
    'Streetstyle': `**Streetstyle Style**: Design a trendy, urban look with contemporary street fashion.
    - Colors: Bold combinations, monochrome, statement colors, graphic prints
    - Fabrics: Mixed materials, denim, technical fabrics, logo prints, quality basics
    - Silhouettes: Oversized tops, fitted bottoms (or vice versa), layered, proportions play
    - Key Pieces: Oversized hoodies, statement sneakers, cargo pants, graphic tees, bomber jackets
    - Accessories: Chunky sneakers, crossbody bags, bucket hats, statement sunglasses, chains
    - Vibe: Urban cool, fashion-forward, influenced by hip-hop and skate culture, trendsetting`,
    
    'Dopamine': `**Dopamine Dressing Style**: Create a bright, cheerful look with mood-boosting colors.
    - Colors: Vibrant, saturated colors - hot pink, electric blue, sunshine yellow, lime green
    - Fabrics: Any fabric in bold colors, mixed textures, playful patterns
    - Silhouettes: Fun and expressive, not restricted by shape - it's all about color impact
    - Key Pieces: Colorful blazers, bright dresses, statement coats, bold accessories
    - Accessories: Colorful bags, bright shoes, fun jewelry, playful sunglasses
    - Vibe: Joyful, energetic, maximalist, happiness-inducing, bold self-expression`,
    
    'Y2K': `**Y2K Style**: Design a nostalgic, early 2000s inspired look with retro-futuristic elements.
    - Colors: Metallics (silver, holographic), hot pink, baby blue, lime green, purple
    - Fabrics: Shiny materials, velour, satin, denim, PVC, metallic finishes
    - Silhouettes: Low-rise pants, crop tops, mini skirts, body-con, visible logos
    - Key Pieces: Cargo pants, baby tees, butterfly clips, platform shoes, mini bags, tracksuits
    - Accessories: Tiny sunglasses, chunky highlights, body glitter, nameplate necklaces, mini bags
    - Vibe: Nostalgic 2000s, pop culture references, Paris Hilton era, playful tech aesthetic`
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

            customPrompt = `You are a professional fashion stylist AI. Generate styled outfit variations based on the uploaded image, creating ONE UNIQUE IMAGE for EACH of the following styles:

${styleDescriptions}

🎯 CRITICAL GENERATION INSTRUCTIONS:

1. **Style Accuracy**: Each generated image MUST precisely match the specific style characteristics listed above:
   - Use the EXACT color palettes specified for each style
   - Apply the EXACT fabric types and textures mentioned
   - Follow the EXACT silhouette guidelines (fit, length, proportions)
   - Include the KEY PIECES characteristic of that style
   - Add appropriate ACCESSORIES that define the style

2. **Visual Execution**:
   - Transform the base outfit to embody the chosen style aesthetic completely
   - Adjust colors, patterns, and textures to match the style's palette
   - Modify silhouettes and proportions according to style guidelines
   - Add or replace accessories to enhance the style identity
   - Ensure fabrics and materials visually reflect the style's typical choices

3. **Maintain Core Structure While Transforming**:
   - Keep the general outfit category (e.g., if it's a dress, keep it as a dress)
   - But feel free to adjust: length, fit, details, styling, colors, patterns, accessories
   - The result should feel like a completely different styled interpretation

4. **Style Differentiation**:
   - Make each style visually DISTINCT from the others
   - Each image should be immediately recognizable as its designated style
   - Avoid generic interpretations - be bold and specific to each aesthetic

5. **Professional Quality**:
   - Create fashion-magazine worthy, polished, styled images
   - Pay attention to coordination and overall aesthetic harmony
   - Ensure each outfit is complete and wearable

Generate ${styleOptions.length} image(s), one for each style listed above. Each must be a unique, professional, and accurate representation of its designated style.`;
        }

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
