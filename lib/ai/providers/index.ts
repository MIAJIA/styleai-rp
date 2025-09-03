import { ImageGenProvider, ProviderId } from './types';
import { KlingProvider } from './KlingProvider';
import { GeminiProvider } from './GeminiProvider';

export function getProvider(id?: ProviderId): ImageGenProvider {
  const desired = id || (process.env.IMAGE_PROVIDER as ProviderId) || 'kling';
  switch (desired) {
    case 'gemini':
      return new GeminiProvider();
    case 'kling':
    default:
      return new KlingProvider();
  }
}


