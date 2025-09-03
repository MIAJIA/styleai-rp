import { ImageGenProvider, ProviderId } from './types';
import { KlingProvider } from './KlingProvider';

export function getProvider(id?: ProviderId): ImageGenProvider {
  const desired = id || (process.env.IMAGE_PROVIDER as ProviderId) || 'kling';
  switch (desired) {
    case 'kling':
    default:
      return new KlingProvider();
  }
}


