import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { type OnboardingData } from "@/lib/onboarding-storage";
import { ProviderId } from "./providers/types";

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
  // accessories: z.array(itemDetailSchema).describe("An array of accessories like jewelry, hats, etc."),
  layering_description: z.string().optional().describe("A description of layering relationships, including the order of wearing, the details of exposure, and the role of layers in style, atmosphere, or structural shaping."),
  hairstyle: hairstyleSchema.describe("The suggested hairstyle."),
});

export const outfitSuggestionSchema = z.object({
  outfit_title: z.string().describe("A short, catchy title for the outfit."),
  items: outfitItemsSchema,
  explanation: z.string().optional().describe("A detailed explanation of why this outfit works for the user, providing styling tips and emotional value."),
});

export const styleSuggestionsSchema = z.object({
  outfit_suggestion: outfitSuggestionSchema.describe("A single complete outfit suggestion."),
  image_prompt: z.string().optional().describe(
    "A vivid, Chinese-only visual prompt for an AI image generator. It should describe the user wearing the outfit in the intended scene, including outfit details, setting, atmosphere, and overall mood. This prompt will be passed to Midjourney or similar models to produce a full-body fashion image. This field is REQUIRED and extremely important.")
});

// Convert Zod schema to JSON schema for the tool
// By not providing a name, we get a more direct schema without the top-level $ref, which is what OpenAI expects.
export const styleSuggestionsJsonSchema = zodToJsonSchema(styleSuggestionsSchema);

export interface StyleSuggestionInput {
  humanImageUrl: string;
  garmentImageUrl: string;
  occasion: string;
  userProfile?: OnboardingData; // optional but encouraged for better personalization
  stylePrompt?: string; // 🔍 新增：场景风格提示
  customPrompt?: string; // 🔍 新增：用户自定义需求
}

// This interface needs to be in sync with the one in the status route and the frontend
export type GenerationMode = "tryon-only" | "simple-scene" | "advanced-scene";

/**
 * Represents a single, self-contained styling suggestion.
 * Each suggestion has its own status for the image generation process.
 */
export interface Suggestion {
  index: number;
  status: 'pending' | 'generating_images' | 'processing_tryon' | 'succeeded' | 'failed';

  // Textual content from AI
  styleSuggestion: any; // Can be refined to a more specific type later
  personaProfile?: any;
  finalPrompt: string;

  stylizedImageUrls?: string;
  tryOnImageUrls?: string;
  // Visuals
  imageUrls?: string[];
  intermediateImageUrls?: string[]; // For stylization previews

  // For error handling
  error?: string;
}

/**
 * Represents a top-level generation job that can contain multiple suggestions.
 */
export interface Job {
  jobId: string;
  userId?: string; // Optional: can be added for user-specific jobs

  // Overall status of the entire job, not individual suggestions
  status: 'pending' | 'processing' | 'completed' | 'failed';

  // The core content of the job: an array of suggestions
  suggestions: Suggestion[];

  // Input parameters for the job
  input: {
    humanImage: { url: string; type: string; name: string };
    garmentImage: { url: string; type: string; name: string };
    generationMode: GenerationMode;
    occasion: string;
    userProfile?: any;
    provider?: ProviderId;
    customPrompt?: string;
    stylePrompt?: string; // 🔍 新增：场景风格提示
  };

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // For error handling at the job level
  error?: string;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';