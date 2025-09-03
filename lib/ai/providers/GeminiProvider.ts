import { ImageGenProvider, ProviderId, GenerationContext, EmitProgress, GenerateResult } from './types';
import { generateFinalImagesWithGemini } from "../services/gemini";
import { IMAGE_FORMAT_DESCRIPTION, STRICT_REALISM_PROMPT_BLOCK } from "../../prompts";
import { kv } from '@vercel/kv';

export class GeminiProvider implements ImageGenProvider {
  id: ProviderId = 'gemini';

  async generateFinalImages(ctx: GenerationContext, emit: EmitProgress): Promise<GenerateResult> {
    emit({ step: 'init' });

    // Build prompt with priority similar to kling.ts
    let finalPrompt = '';
    const suggestion = ctx.suggestion as any | undefined;
    if (suggestion?.styleSuggestion?.image_prompt) {
      finalPrompt = suggestion.styleSuggestion.image_prompt;
    } else if (suggestion?.styleSuggestion?.outfit_suggestion) {
      const outfitDetails = suggestion.styleSuggestion.outfit_suggestion;
      const outfitDescription = outfitDetails.explanation || outfitDetails.style_summary || "A stylish outfit";
      finalPrompt = `${outfitDetails.outfit_title || "Stylish Look"}. ${outfitDescription}`;
    } else {
      finalPrompt = "A full-body shot of a person in a stylish outfit, realistic, well-lit, high-quality.";
    }
    finalPrompt = `${finalPrompt}. ${IMAGE_FORMAT_DESCRIPTION} ${STRICT_REALISM_PROMPT_BLOCK}`;
    if (finalPrompt.length > 2500) {
      finalPrompt = finalPrompt.substring(0, 2500);
    }

    emit({ step: 'submit' });
    const images = await generateFinalImagesWithGemini({
      prompt: finalPrompt,
      humanImageUrl: ctx.humanImage.url,
      garmentImageUrl: ctx.garmentImage?.url,
      garmentImageName: ctx.garmentImage?.name,
      garmentImageType: ctx.garmentImage?.type,
    });

    emit({ step: 'save' });
    // Persist minimal fields into KV (align with existing job shape)
    if (ctx.job) {
      const job = ctx.job;
      if (job.suggestions[ctx.suggestionIndex]) {
        job.suggestions[ctx.suggestionIndex].tryOnImageUrls = images[0];
        job.suggestions[ctx.suggestionIndex].finalPrompt = finalPrompt;
        job.updatedAt = Date.now();
        await kv.set(job.jobId, job);
      }
    }

    emit({ step: 'done' });
    return { finalImageUrls: images, finalPrompt };
  }
}


