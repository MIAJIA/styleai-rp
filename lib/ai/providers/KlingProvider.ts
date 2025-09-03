import { ImageGenProvider, ProviderId, GenerationContext, EmitProgress, GenerateResult } from './types';
import { KlingTaskHandler } from "../services/klingTask";
import { kv } from '@vercel/kv';

export class KlingProvider implements ImageGenProvider {
  id: ProviderId = 'kling';

  async generateFinalImages(ctx: GenerationContext, emit: EmitProgress): Promise<GenerateResult> {
    emit({ step: 'init' });

    const job = ctx.job;
    if (!job) {
      throw new Error('KlingProvider requires ctx.job to be provided');
    }

    const handler = new KlingTaskHandler(job, ctx.suggestionIndex);

    emit({ step: 'stylize_start' });
    const stylizedImageUrl = await handler.runStylizationMultiple('kling-v1-5');
    emit({ step: 'stylize_done', message: stylizedImageUrl });

    emit({ step: 'tryon_start' });
    const tryOnImageUrl = await handler.runVirtualTryOnMultiple();
    emit({ step: 'tryon_done', message: tryOnImageUrl });

    emit({ step: 'save' });
    // handler 内部已更新 KV；此处补充一次读取用于返回更完整的数据
    const updated = await kv.get<typeof job>(job.jobId);

    emit({ step: 'done' });
    return {
      finalImageUrls: updated?.suggestions?.[ctx.suggestionIndex]?.tryOnImageUrls ? [updated.suggestions[ctx.suggestionIndex].tryOnImageUrls as unknown as string] : [tryOnImageUrl],
      stylizedImageUrls: updated?.suggestions?.[ctx.suggestionIndex]?.stylizedImageUrls ? [updated.suggestions[ctx.suggestionIndex].stylizedImageUrls as unknown as string] : [stylizedImageUrl],
      finalPrompt: updated?.suggestions?.[ctx.suggestionIndex]?.finalPrompt,
    };
  }
}


