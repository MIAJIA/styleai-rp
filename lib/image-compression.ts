/**
 * Smart Image Compression Service - SSR Compatible Version
 * Supports WebP, AVIF, JPEG format auto-detection and multi-level compression strategies
 */

export interface ImageCompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'image/jpeg' | 'image/webp' | 'image/avif' | 'auto';
  fallbackFormat: 'image/jpeg';
}

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  format: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: {
    width: number;
    height: number;
  };
  processingTime: number;
}

export interface CompressionMetrics {
  processingTime: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality: number;
  format: string;
  userAgent: string;
  deviceType: string;
}

// Preset compression configurations
export const COMPRESSION_PRESETS = {
  // Chat images - balance quality and speed
  chat: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 0.8,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // Thumbnails - prioritize speed
  thumbnail: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // Previews - extreme compression
  preview: {
    maxWidth: 100,
    maxHeight: 100,
    quality: 0.6,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // High quality - for important images
  highQuality: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.9,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // New preset for targeting specific file size
  forUpload: {
    maxSizeMB: 0.19, // Target < 200KB
    maxWidthOrHeight: 1024, // Max dimension
    useWebWorker: true,
  }
} as const;

// Client-side detection utility functions
function isClientSide(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export class SmartImageCompressor {
  private supportedFormats: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    // Initialize only on client side
    if (isClientSide()) {
      this.detectSupportedFormats();
      this.isInitialized = true;
    }
  }

  /**
   * Detect browser-supported image formats
   */
  private detectSupportedFormats(): void {
    if (!isClientSide()) {
      console.warn('[ImageCompressor] detectSupportedFormats called on server side');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;

      // Detect WebP support
      if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        this.supportedFormats.add('image/webp');
      }

      // Detect AVIF support
      if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
        this.supportedFormats.add('image/avif');
      }

      // JPEG and PNG are always supported
      this.supportedFormats.add('image/jpeg');
      this.supportedFormats.add('image/png');

      console.log('[ImageCompressor] Supported formats detected:', Array.from(this.supportedFormats));
    } catch (error) {
      console.warn('[ImageCompressor] Format detection failed, using fallback:', error);
      // Fallback support
      this.supportedFormats.add('image/jpeg');
      this.supportedFormats.add('image/png');
    }
  }

  /**
   * Ensure initialization on client side
   */
  private ensureInitialized(): void {
    if (!this.isInitialized && isClientSide()) {
      this.detectSupportedFormats();
      this.isInitialized = true;
    }
  }

  /**
   * Get the optimal image format
   */
  private getOptimalFormat(requestedFormat: string): string {
    this.ensureInitialized();

    if (requestedFormat !== 'auto') {
      return this.supportedFormats.has(requestedFormat) ? requestedFormat : 'image/jpeg';
    }

    // Select the best format based on priority
    if (this.supportedFormats.has('image/avif')) {
      return 'image/avif';
    } else if (this.supportedFormats.has('image/webp')) {
      return 'image/webp';
    } else {
      return 'image/jpeg';
    }
  }

  /**
   * Calculate the optimal dimensions
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1); // Do not enlarge the image

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  /**
   * Compress image - client-side safe version
   */
  async compressImage(
    file: File,
    config: ImageCompressionConfig
  ): Promise<CompressedImageResult> {
    if (!isClientSide()) {
      throw new Error('Image compression is only available on the client side');
    }

    this.ensureInitialized();

    const startTime = performance.now();
    const originalSize = file.size;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        try {
          // Calculate optimal dimensions
          const dimensions = this.calculateOptimalDimensions(
            img.width,
            img.height,
            config.maxWidth,
            config.maxHeight
          );

          // Select the optimal format
          const optimalFormat = this.getOptimalFormat(config.format);

          // Create Canvas and compress
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          // Draw image
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

          // Convert to Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              // Create DataURL
              const reader = new FileReader();
              reader.onloadend = () => {
                const processingTime = performance.now() - startTime;
                const compressedSize = blob.size;
                const compressionRatio = (originalSize - compressedSize) / originalSize;

                const result: CompressedImageResult = {
                  blob,
                  dataUrl: reader.result as string,
                  format: optimalFormat,
                  originalSize,
                  compressedSize,
                  compressionRatio,
                  dimensions,
                  processingTime
                };

                // Record compression metrics
                this.trackCompression({
                  processingTime,
                  originalSize,
                  compressedSize,
                  compressionRatio,
                  quality: config.quality,
                  format: optimalFormat,
                  userAgent: navigator.userAgent,
                  deviceType: this.getDeviceType()
                });

                resolve(result);
                URL.revokeObjectURL(url);
              };
              reader.readAsDataURL(blob);
            },
            optimalFormat,
            config.quality
          );
        } catch (error) {
          reject(error);
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(url);
      };

      img.src = url;
    });
  }

  /**
   * Batch compress images
   */
  async compressImages(
    files: File[],
    config: ImageCompressionConfig,
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<CompressedImageResult[]> {
    if (!isClientSide()) {
      throw new Error('Image compression is only available on the client side');
    }

    const results: CompressedImageResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (onProgress) {
        onProgress((i / files.length) * 100, file.name);
      }

      try {
        const result = await this.compressImage(file, config);
        results.push(result);
      } catch (error) {
        console.error(`Failed to compress ${file.name}:`, error);
        // Continue processing other files
      }
    }

    if (onProgress) {
      onProgress(100, '');
    }

    return results;
  }

  /**
   * Verify if compression quality is acceptable
   */
  isQualityAcceptable(result: CompressedImageResult): boolean {
    return (
      result.compressionRatio > 0.1 && // At least 10% compression
      result.compressionRatio < 0.95 && // No more than 95% compression
      result.dimensions.width >= 50 && // Minimum width
      result.dimensions.height >= 50 && // Minimum height
      result.compressedSize > 1000 // Minimum file size 1KB
    );
  }

  /**
   * Get browser-supported format list
   */
  getSupportedFormats(): string[] {
    this.ensureInitialized();
    return Array.from(this.supportedFormats);
  }

  /**
   * Record compression metrics
   */
  private trackCompression(metrics: CompressionMetrics): void {
    // Send to analysis service or local storage
    console.log('Compression metrics:', metrics);

    // Can integrate Analytics service
    if (isClientSide() && (window as any).gtag) {
      (window as any).gtag('event', 'image_compression', {
        custom_map: {
          compression_ratio: metrics.compressionRatio,
          processing_time: metrics.processingTime,
          format: metrics.format
        }
      });
    }
  }

  /**
   * Get device type
   */
  private getDeviceType(): string {
    if (!isClientSide()) {
      return 'unknown';
    }

    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Compress image to a target size - client-side safe version
   */
  async compressImageToSize(
    file: File,
    options: { maxSizeMB: number; maxWidthOrHeight: number; useWebWorker: boolean }
  ): Promise<CompressedImageResult> {
    if (!isClientSide()) {
      throw new Error('Image compression is only available on the client side');
    }

    // Dynamic import of browser-image-compression
    const imageCompression = (await import('browser-image-compression')).default;

    this.ensureInitialized();
    const startTime = performance.now();
    const originalSize = file.size;

    try {
      const compressedFile = await imageCompression(file, options);
      const compressedSize = compressedFile.size;
      const compressionRatio = (originalSize - compressedSize) / originalSize;

      const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
      const img = await imageCompression.loadImage(dataUrl);

      const result: CompressedImageResult = {
        blob: compressedFile,
        dataUrl,
        format: compressedFile.type,
        originalSize,
        compressedSize,
        compressionRatio,
        dimensions: { width: img.width, height: img.height },
        processingTime: performance.now() - startTime
      };

      return result;
    } catch (error) {
      console.error('Compression to size failed:', error);
      throw error;
    }
  }
}

// Lazy load singleton instance
let _imageCompressor: SmartImageCompressor | null = null;

function getImageCompressor(): SmartImageCompressor {
  if (!isClientSide()) {
    throw new Error('Image compressor is only available on the client side');
  }

  if (!_imageCompressor) {
    _imageCompressor = new SmartImageCompressor();
  }

  return _imageCompressor;
}

// Convenient method - client-side safe version
export async function compressForChat(file: File): Promise<CompressedImageResult> {
  return getImageCompressor().compressImage(file, COMPRESSION_PRESETS.chat);
}

export async function compressForThumbnail(file: File): Promise<CompressedImageResult> {
  return getImageCompressor().compressImage(file, COMPRESSION_PRESETS.thumbnail);
}

export async function compressForPreview(file: File): Promise<CompressedImageResult> {
  return getImageCompressor().compressImage(file, COMPRESSION_PRESETS.preview);
}

export async function compressHighQuality(file: File): Promise<CompressedImageResult> {
  return getImageCompressor().compressImage(file, COMPRESSION_PRESETS.highQuality);
}

// New convenient method for size-based compression
export async function compressImageToSpecificSize(file: File): Promise<CompressedImageResult> {
  return getImageCompressor().compressImageToSize(file, COMPRESSION_PRESETS.forUpload);
}
