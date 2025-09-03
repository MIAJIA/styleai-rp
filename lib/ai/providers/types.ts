import { Job } from "../types";

export type ProviderId = 'kling' | 'gemini';

export interface GenerationContext {
  jobId: string;
  suggestionIndex: number;
  humanImage: { url: string; name: string; type: string };
  garmentImage?: { url: string; name: string; type: string };
  suggestion?: any;
  userId?: string;
  job?: Job;
}

export interface GenerateResult {
  finalImageUrls: string[];
  stylizedImageUrls?: string[];
  finalPrompt?: string;
}

export type ProgressEvent =
  | { step: 'init' | 'submit' | 'poll' | 'save' | 'done'; message?: string }
  | { step: 'stylize_start' | 'stylize_done' | 'tryon_start' | 'tryon_done'; message?: string };

export type EmitProgress = (evt: ProgressEvent) => void;

export interface ImageGenProvider {
  id: ProviderId;
  generateFinalImages(ctx: GenerationContext, emit: EmitProgress): Promise<GenerateResult>;
}


