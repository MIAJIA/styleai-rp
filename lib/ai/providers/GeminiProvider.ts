import { ImageGenProvider, ProviderId, GenerationContext, EmitProgress, GenerateResult } from './types';
import { generateFinalImagesWithGemini } from "../services/gemini";
import { IMAGE_FORMAT_DESCRIPTION, STRICT_REALISM_PROMPT_BLOCK } from "../../prompts";
import { kv } from '@vercel/kv';

export class GeminiProvider implements ImageGenProvider {
  id: ProviderId = 'gemini';

  async generateFinalImages(ctx: GenerationContext, emit: EmitProgress): Promise<GenerateResult> {
    console.log('🚀 [GEMINI_PROVIDER] ===== GEMINI PROVIDER STARTED =====');
    console.log('🚀 [GEMINI_PROVIDER] 📋 Context details:');
    console.log('🚀 [GEMINI_PROVIDER] 📋 - Job ID:', ctx.jobId);
    console.log('🚀 [GEMINI_PROVIDER] 📋 - Suggestion index:', ctx.suggestionIndex);
    console.log('🚀 [GEMINI_PROVIDER] 📋 - Human image URL:', ctx.humanImage.url?.substring(0, 100) + '...');
    console.log('🚀 [GEMINI_PROVIDER] 📋 - Garment image URL:', ctx.garmentImage?.url?.substring(0, 100) + '...' || 'N/A');
    console.log('🚀 [GEMINI_PROVIDER] 📋 - User ID:', ctx.userId);
    
    emit({ step: 'init' });

    // Build prompt with priority similar to kling.ts
    console.log('🚀 [GEMINI_PROVIDER] 🔧 Building prompt...');
    let finalPrompt = '';
    const suggestion = ctx.suggestion as any | undefined;
    
    console.log('🚀 [GEMINI_PROVIDER] 🔧 Suggestion data available:', !!suggestion);
    console.log('🚀 [GEMINI_PROVIDER] 🔧 Style suggestion available:', !!suggestion?.styleSuggestion);
    console.log('🚀 [GEMINI_PROVIDER] 🔧 Image prompt available:', !!suggestion?.styleSuggestion?.image_prompt);
    
    if (suggestion?.styleSuggestion?.image_prompt) {
      finalPrompt = suggestion.styleSuggestion.image_prompt;
      console.log('🚀 [GEMINI_PROVIDER] 🔧 Using AI-generated image_prompt (highest priority)');
    } else if (suggestion?.styleSuggestion?.outfit_suggestion) {
      const outfitDetails = suggestion.styleSuggestion.outfit_suggestion;
      const outfitDescription = outfitDetails.explanation || outfitDetails.style_summary || "A stylish outfit";
      finalPrompt = `${outfitDetails.outfit_title || "Stylish Look"}. ${outfitDescription}`;
      console.log('🚀 [GEMINI_PROVIDER] 🔧 Using outfit details fallback');
    } else {
      finalPrompt = "A full-body shot of a person in a stylish outfit, realistic, well-lit, high-quality.";
      console.log('🚀 [GEMINI_PROVIDER] 🔧 Using default fallback prompt');
    }
    
    finalPrompt = `${finalPrompt}. ${IMAGE_FORMAT_DESCRIPTION} ${STRICT_REALISM_PROMPT_BLOCK}`;
    if (finalPrompt.length > 2500) {
      console.log('🚀 [GEMINI_PROVIDER] ⚠️ Prompt too long, truncating from', finalPrompt.length, 'to 2500 chars');
      finalPrompt = finalPrompt.substring(0, 2500);
    }
    
    console.log('🚀 [GEMINI_PROVIDER] ===== FINAL PROMPT FOR GEMINI =====');
    console.log('🚀 [GEMINI_PROVIDER] 📄 PROMPT LENGTH:', finalPrompt.length);
    console.log('🚀 [GEMINI_PROVIDER] 📄 PROMPT CONTENT:', finalPrompt);
    console.log('🚀 [GEMINI_PROVIDER] ===== END PROMPT =====');

    emit({ step: 'submit' });
    console.log('🚀 [GEMINI_PROVIDER] 🔄 Calling Gemini service...');
    
    const images = await generateFinalImagesWithGemini({
      prompt: finalPrompt,
      humanImageUrl: ctx.humanImage.url,
      humanImageName: ctx.humanImage.name,
      humanImageType: ctx.humanImage.type,
      garmentImageUrl: ctx.garmentImage?.url,
      garmentImageName: ctx.garmentImage?.name,
      garmentImageType: ctx.garmentImage?.type,
    });
    
    console.log('🚀 [GEMINI_PROVIDER] ✅ Gemini service returned', images.length, 'images');
    images.forEach((img, i) => {
      console.log('🚀 [GEMINI_PROVIDER] 📷 Image', i + 1, 'type:', img.substring(0, 30) + '...');
    });

    emit({ step: 'save' });
    console.log('🚀 [GEMINI_PROVIDER] 💾 Saving results to KV...');
    
    // Persist minimal fields into KV (align with existing job shape)
    if (ctx.job) {
      const job = ctx.job;
      if (job.suggestions[ctx.suggestionIndex]) {
        job.suggestions[ctx.suggestionIndex].tryOnImageUrls = images[0];
        job.suggestions[ctx.suggestionIndex].finalPrompt = finalPrompt;
        job.updatedAt = Date.now();
        await kv.set(job.jobId, job);
        console.log('🚀 [GEMINI_PROVIDER] ✅ KV updated successfully');
      } else {
        console.log('🚀 [GEMINI_PROVIDER] ⚠️ No suggestion found at index', ctx.suggestionIndex);
      }
    } else {
      console.log('🚀 [GEMINI_PROVIDER] ⚠️ No job context provided');
    }

    emit({ step: 'done' });
    console.log('🚀 [GEMINI_PROVIDER] ===== GEMINI PROVIDER COMPLETED =====');
    return { finalImageUrls: images, finalPrompt };
  }
}


