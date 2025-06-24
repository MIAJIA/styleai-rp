/**
 * 智能图像压缩服务 - SSR 兼容版本
 * 支持WebP、AVIF、JPEG格式自动检测和多级压缩策略
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

// 预设压缩配置
export const COMPRESSION_PRESETS = {
  // 聊天图片 - 平衡质量和速度
  chat: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 0.8,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // 缩略图 - 优先速度
  thumbnail: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // 预览图 - 极限压缩
  preview: {
    maxWidth: 100,
    maxHeight: 100,
    quality: 0.6,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  },
  // 高质量 - 用于重要图片
  highQuality: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.9,
    format: 'auto' as const,
    fallbackFormat: 'image/jpeg' as const
  }
} as const;

// 客户端检测工具函数
function isClientSide(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export class SmartImageCompressor {
  private supportedFormats: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    // 只在客户端初始化
    if (isClientSide()) {
      this.detectSupportedFormats();
      this.isInitialized = true;
    }
  }

  /**
   * 检测浏览器支持的图像格式
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

      // 检测WebP支持
      if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        this.supportedFormats.add('image/webp');
      }

      // 检测AVIF支持
      if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
        this.supportedFormats.add('image/avif');
      }

      // JPEG和PNG始终支持
      this.supportedFormats.add('image/jpeg');
      this.supportedFormats.add('image/png');

      console.log('[ImageCompressor] Supported formats detected:', Array.from(this.supportedFormats));
    } catch (error) {
      console.warn('[ImageCompressor] Format detection failed, using fallback:', error);
      // 降级支持
      this.supportedFormats.add('image/jpeg');
      this.supportedFormats.add('image/png');
    }
  }

  /**
   * 确保在客户端初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized && isClientSide()) {
      this.detectSupportedFormats();
      this.isInitialized = true;
    }
  }

  /**
   * 获取最优的图像格式
   */
  private getOptimalFormat(requestedFormat: string): string {
    this.ensureInitialized();

    if (requestedFormat !== 'auto') {
      return this.supportedFormats.has(requestedFormat) ? requestedFormat : 'image/jpeg';
    }

    // 按优先级选择最佳格式
    if (this.supportedFormats.has('image/avif')) {
      return 'image/avif';
    } else if (this.supportedFormats.has('image/webp')) {
      return 'image/webp';
    } else {
      return 'image/jpeg';
    }
  }

  /**
   * 计算最优尺寸
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1); // 不放大图片

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  /**
   * 压缩图像 - 客户端安全版本
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
          // 计算最优尺寸
          const dimensions = this.calculateOptimalDimensions(
            img.width,
            img.height,
            config.maxWidth,
            config.maxHeight
          );

          // 选择最优格式
          const optimalFormat = this.getOptimalFormat(config.format);

          // 创建Canvas并压缩
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          // 绘制图像
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

          // 转换为Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              // 创建DataURL
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

                // 记录压缩指标
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
   * 批量压缩图像
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
        // 继续处理其他文件
      }
    }

    if (onProgress) {
      onProgress(100, '');
    }

    return results;
  }

  /**
   * 验证压缩质量是否可接受
   */
  isQualityAcceptable(result: CompressedImageResult): boolean {
    return (
      result.compressionRatio > 0.1 && // 至少10%压缩
      result.compressionRatio < 0.95 && // 不超过95%压缩
      result.dimensions.width >= 50 && // 最小宽度
      result.dimensions.height >= 50 && // 最小高度
      result.compressedSize > 1000 // 最小文件大小1KB
    );
  }

  /**
   * 获取浏览器支持的格式列表
   */
  getSupportedFormats(): string[] {
    this.ensureInitialized();
    return Array.from(this.supportedFormats);
  }

  /**
   * 记录压缩指标
   */
  private trackCompression(metrics: CompressionMetrics): void {
    // 发送到分析服务或本地存储
    console.log('Compression metrics:', metrics);

    // 可以集成Analytics服务
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
   * 获取设备类型
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
}

// 懒加载单例实例
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

// 便捷方法 - 客户端安全版本
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