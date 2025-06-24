/**
 * React Hook for Image Compression
 * 提供图像压缩功能的React Hook
 */

import { useState, useCallback, useRef } from 'react';
import {
  SmartImageCompressor,
  CompressedImageResult,
  ImageCompressionConfig,
  COMPRESSION_PRESETS
} from '../image-compression';

// 懒加载图片压缩器实例
const getCompressor = (): SmartImageCompressor => {
  if (typeof window === 'undefined') {
    throw new Error('Image compression is only available on the client side');
  }
  return new SmartImageCompressor();
};

export interface UseImageCompressionOptions {
  preset?: keyof typeof COMPRESSION_PRESETS;
  customConfig?: ImageCompressionConfig;
  onProgress?: (progress: number, currentFile: string) => void;
  onError?: (error: Error, fileName?: string) => void;
  onSuccess?: (result: CompressedImageResult, fileName: string) => void;
}

export interface CompressionState {
  isCompressing: boolean;
  progress: number;
  currentFile: string;
  error: string | null;
  results: CompressedImageResult[];
}

export function useImageCompression(options: UseImageCompressionOptions = {}) {
  const [state, setState] = useState<CompressionState>({
    isCompressing: false,
    progress: 0,
    currentFile: '',
    error: null,
    results: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取压缩配置
  const getConfig = useCallback((): ImageCompressionConfig => {
    if (options.customConfig) {
      return options.customConfig;
    }
    const preset = options.preset || 'chat';
    return COMPRESSION_PRESETS[preset];
  }, [options.customConfig, options.preset]);

  // 压缩单个文件
  const compressFile = useCallback(async (file: File): Promise<CompressedImageResult> => {
    if (!file.type.startsWith('image/')) {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }

    setState(prev => ({
      ...prev,
      isCompressing: true,
      progress: 0,
      currentFile: file.name,
      error: null
    }));

    try {
      const config = getConfig();
      const result = await getCompressor().compressImage(file, config);

      setState(prev => ({
        ...prev,
        progress: 100,
        results: [...prev.results, result]
      }));

      // 调用成功回调
      if (options.onSuccess) {
        options.onSuccess(result, file.name);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '压缩失败';
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));

      // 调用错误回调
      if (options.onError) {
        options.onError(error as Error, file.name);
      }

      throw error;
    } finally {
      setState(prev => ({
        ...prev,
        isCompressing: false,
        currentFile: ''
      }));
    }
  }, [getConfig, options.onSuccess, options.onError]);

  // 批量压缩文件
  const compressFiles = useCallback(async (files: File[]): Promise<CompressedImageResult[]> => {
    if (files.length === 0) return [];

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isCompressing: true,
      progress: 0,
      error: null,
      results: []
    }));

    const config = getConfig();
    const results: CompressedImageResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        // 检查是否被中止
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('压缩被用户中止');
        }

        const file = files[i];
        const progress = (i / files.length) * 100;

        setState(prev => ({
          ...prev,
          progress,
          currentFile: file.name
        }));

        // 调用进度回调
        if (options.onProgress) {
          options.onProgress(progress, file.name);
        }

        try {
          const result = await getCompressor().compressImage(file, config);
          results.push(result);

          // 调用成功回调
          if (options.onSuccess) {
            options.onSuccess(result, file.name);
          }
        } catch (error) {
          console.error(`压缩文件 ${file.name} 失败:`, error);

          // 调用错误回调但继续处理其他文件
          if (options.onError) {
            options.onError(error as Error, file.name);
          }
        }
      }

      setState(prev => ({
        ...prev,
        progress: 100,
        results,
        currentFile: ''
      }));

      // 最终进度回调
      if (options.onProgress) {
        options.onProgress(100, '');
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量压缩失败';
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));

      throw error;
    } finally {
      setState(prev => ({
        ...prev,
        isCompressing: false,
        currentFile: ''
      }));
      abortControllerRef.current = null;
    }
  }, [getConfig, options.onProgress, options.onSuccess, options.onError]);

  // 中止压缩
  const abortCompression = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      isCompressing: false,
      progress: 0,
      currentFile: '',
      error: '压缩已中止'
    }));
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setState({
      isCompressing: false,
      progress: 0,
      currentFile: '',
      error: null,
      results: []
    });
  }, []);

  // 获取压缩统计
  const getCompressionStats = useCallback(() => {
    const { results } = state;
    if (results.length === 0) return null;

    const totalOriginalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, result) => sum + result.compressedSize, 0);
    const averageCompressionRatio = results.reduce((sum, result) => sum + result.compressionRatio, 0) / results.length;
    const averageProcessingTime = results.reduce((sum, result) => sum + result.processingTime, 0) / results.length;

    return {
      totalFiles: results.length,
      totalOriginalSize,
      totalCompressedSize,
      totalSavedBytes: totalOriginalSize - totalCompressedSize,
      averageCompressionRatio,
      averageProcessingTime,
      formats: [...new Set(results.map(r => r.format))]
    };
  }, [state.results]);

  // 获取浏览器支持的格式
  const getSupportedFormats = useCallback(() => {
    return getCompressor().getSupportedFormats();
  }, []);

  return {
    // 状态
    ...state,

    // 方法
    compressFile,
    compressFiles,
    abortCompression,
    reset,

    // 工具方法
    getCompressionStats,
    getSupportedFormats,

    // 便捷方法
    compressForChat: useCallback((file: File) => {
      return getCompressor().compressImage(file, COMPRESSION_PRESETS.chat);
    }, []),

    compressForThumbnail: useCallback((file: File) => {
      return getCompressor().compressImage(file, COMPRESSION_PRESETS.thumbnail);
    }, []),

    compressForPreview: useCallback((file: File) => {
      return getCompressor().compressImage(file, COMPRESSION_PRESETS.preview);
    }, []),
  };
}

// 便捷的文件选择器Hook
export function useImagePicker() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback((options?: {
    multiple?: boolean;
    accept?: string;
  }) => {
    if (fileInputRef.current) {
      fileInputRef.current.multiple = options?.multiple || false;
      fileInputRef.current.accept = options?.accept || 'image/*';
      fileInputRef.current.click();
      setIsPickerOpen(true);
    }
  }, []);

  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const createFileInput = useCallback((onFileSelect: (files: File[]) => void) => (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={(e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          onFileSelect(files);
        }
        closePicker();
      }}
    />
  ), [closePicker]);

  return {
    isPickerOpen,
    openPicker,
    closePicker,
    createFileInput,
    fileInputRef
  };
}