import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { type OnboardingData } from "@/lib/onboarding-storage";

// Zod schema for structured output, matching the format in lib/prompts.ts
export const itemDetailSchema = z.object({
  item_name: z.string().describe('The name of the clothing item or accessory.'),
  style_details: z.string().describe('The style details of the clothing item or accessory.'),
  wearing_details: z.string().describe('The wearing details of the clothing item or accessory.'),
  effect_description: z.string().optional().describe('The effect description of the clothing item or accessory.'),
});

export const hairstyleSchema = z.object({
  style_name: z.string().describe("The name of the hairstyle."),
  description: z.string().describe("A brief description of the hairstyle and why it complements the outfit.")
});

export const outfitItemsSchema = z.object({
  tops: z.array(itemDetailSchema).describe("An array of top items, which can include layers."),
  bottoms: itemDetailSchema.describe("The bottom item."),
  shoes: itemDetailSchema.describe("The shoes."),
  bag: itemDetailSchema.describe("The bag or purse."),
  accessories: z.array(itemDetailSchema).describe("An array of accessories like jewelry, hats, etc."),
  layering_description: z.string().optional().describe("A description of layering relationships, including the order of wearing, the details of exposure, and the role of layers in style, atmosphere, or structural shaping."),
  hairstyle: hairstyleSchema.describe("The suggested hairstyle."),
});

export const outfitSuggestionSchema = z.object({
  outfit_title: z.string().describe("A short, catchy title for the outfit."),
  items: outfitItemsSchema,
  explanation: z.string().describe("A detailed explanation of why this outfit works for the user, providing styling tips and emotional value."),
});

export const styleSuggestionsSchema = z.object({
  outfit_suggestion: outfitSuggestionSchema.describe("A single complete outfit suggestion."),
  image_prompt: z.string().describe(
    "A vivid, English-only visual prompt for an AI image generator. It should describe the user wearing the outfit in the intended scene, including outfit details, setting, atmosphere, and overall mood. This prompt will be passed to Midjourney or similar models to produce a full-body fashion image.")
});

// Convert Zod schema to JSON schema for the tool
// By not providing a name, we get a more direct schema without the top-level $ref, which is what OpenAI expects.
export const styleSuggestionsJsonSchema = zodToJsonSchema(styleSuggestionsSchema);

export interface StyleSuggestionInput {
  humanImageUrl: string;
  garmentImageUrl: string;
  occasion: string;
  userProfile?: OnboardingData; // optional but encouraged for better personalization
}

// This interface needs to be in sync with the one in the status route and the frontend
export type GenerationMode = "tryon-only" | "simple-scene" | "advanced-scene";

export interface Job {
  jobId: string;
  humanImage: { url: string; type: string; name: string };
  garmentImage: { url: string; type: string; name: string };
  generationMode: GenerationMode;
  occasion: string;
  status: string;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  userProfile?: any; // User profile data
  customPrompt?: string; // Custom prompt for stylization
  cancelled?: boolean; // Flag to indicate if job was cancelled by user
  suggestion?: {
    outfit_suggestion: any; // Single outfit suggestion
    image_prompt: string; // Single image prompt
    [key: string]: any;
  };
  processImages?: {
    styledImages?: string[];  // Changed to array
    styledImage?: string;     // Keep for backward compatibility
    tryOnImages?: string[];   // Changed to array
    tryOnImage?: string;      // Keep for backward compatibility
  };
  result?: {
    imageUrls?: string[];     // Added array version
    imageUrl?: string;        // Keep for backward compatibility
    totalImages?: number;     // Added count
  };
  error?: string;
  [key: string]: any; // Index signature for Vercel KV compatibility
}