'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useImageCompression, useImagePicker } from '@/lib/hooks/use-image-compression';
import { CompressedImageResult } from '@/lib/image-compression';

interface SmartImageUploaderProps {
  onImageSelect: (result: CompressedImageResult) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  preset?: 'chat' | 'thumbnail' | 'preview' | 'highQuality';
  showPreview?: boolean;
  showCompressionStats?: boolean;
  className?: string;
}

export function SmartImageUploader({
  onImageSelect,
  onError,
  maxFiles = 1,
  preset = 'chat',
  showPreview = true,
  showCompressionStats = true,
  className = ''
}: SmartImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<CompressedImageResult[]>([]);

  const {
    isCompressing,
    progress,
    currentFile,
    error,
    compressFile,
    reset,
    getSupportedFormats
  } = useImageCompression({
    preset,
    onSuccess: (result, fileName) => {
      console.log(`✅ Compression successful: ${fileName}`, {
        'Original size': `${(result.originalSize / 1024).toFixed(1)}KB`,
        'Compressed': `${(result.compressedSize / 1024).toFixed(1)}KB`,
        'Compression ratio': `${(result.compressionRatio * 100).toFixed(1)}%`,
        'Format': result.format,
        'Processing time': `${result.processingTime.toFixed(0)}ms`
      });

      setUploadedImages(prev => [...prev, result]);
      onImageSelect(result);
    },
    onError: (error, fileName) => {
      console.error(`❌ Compression failed: ${fileName}`, error.message);
      if (onError) {
        onError(`Compression failed: ${error.message}`);
      }
    }
  });

  const { openPicker, createFileInput } = useImagePicker();

  // Handle file selection
  const handleFileSelect = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Limit file count
    const filesToProcess = files.slice(0, maxFiles);

    // Reset previous state
    reset();
    setUploadedImages([]);

    // Compress files
    for (const file of filesToProcess) {
      try {
        await compressFile(file);
      } catch (error) {
        console.error('Compression failed:', error);
      }
    }
  }, [maxFiles, reset, compressFile]);

  // Drag and drop handling
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const supportedFormats = getSupportedFormats();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload area */}
      <Card
        className={`
          relative border-2 border-dashed transition-colors duration-200 cursor-pointer
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isCompressing ? 'pointer-events-none opacity-75' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isCompressing && openPicker({ multiple: maxFiles > 1 })}
      >
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          {isCompressing ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{currentFile}</p>
                <Progress value={progress} className="w-48" />
                <p className="text-xs text-gray-500">{Math.round(progress)}% complete</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                <Upload className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Click or drag to upload images
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports {supportedFormats.join(', ')} formats
                </p>
                {maxFiles > 1 && (
                  <p className="text-xs text-gray-500">
                    Select up to {maxFiles} images
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <Card className="p-3 bg-red-50 border-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Uploaded image preview */}
      {showPreview && uploadedImages.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Images</h4>
          <div className="grid grid-cols-2 gap-3">
            {uploadedImages.map((result, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className="aspect-square">
                  <img
                    src={result.dataUrl}
                    alt={`Uploaded image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Remove button */}
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 w-6 h-6 p-0 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>

                {/* Compression info */}
                {showCompressionStats && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2">
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="secondary" className="text-xs">
                        {result.format.replace('image/', '').toUpperCase()}
                      </Badge>
                      <span>
                        {formatFileSize(result.originalSize)} → {formatFileSize(result.compressedSize)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span>Compression ratio: {(result.compressionRatio * 100).toFixed(1)}%</span>
                      <span>{result.dimensions.width}×{result.dimensions.height}</span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Browser format support info */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-2">
          <ImageIcon className="w-4 h-4 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-700">Smart Compression</p>
            <p className="text-xs text-blue-600 mt-1">
              Auto-select optimal format ({supportedFormats.includes('image/avif') ? 'AVIF' :
                supportedFormats.includes('image/webp') ? 'WebP' : 'JPEG'})
              , preset: {preset.toUpperCase()}
            </p>
          </div>
        </div>
      </Card>

      {/* Hidden file input */}
      {createFileInput(handleFileSelect)}
    </div>
  );
}

// Compression stats display component
interface CompressionStatsProps {
  results: CompressedImageResult[];
  className?: string;
}

export function CompressionStats({ results, className = '' }: CompressionStatsProps) {
  if (results.length === 0) return null;

  const totalOriginalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
  const totalCompressedSize = results.reduce((sum, result) => sum + result.compressedSize, 0);
  const averageCompressionRatio = results.reduce((sum, result) => sum + result.compressionRatio, 0) / results.length;
  const totalSavedBytes = totalOriginalSize - totalCompressedSize;
  const formats = [...new Set(results.map(r => r.format))];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <Card className={`p-4 bg-green-50 border-green-200 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <h3 className="font-semibold text-green-700">Compression Statistics</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Total images:</span>
          <span className="ml-2 font-medium">{results.length}</span>
        </div>
        <div>
          <span className="text-gray-600">Average compression ratio:</span>
          <span className="ml-2 font-medium text-green-600">
            {(averageCompressionRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-gray-600">Original size:</span>
          <span className="ml-2 font-medium">{formatFileSize(totalOriginalSize)}</span>
        </div>
        <div>
          <span className="text-gray-600">Compressed:</span>
          <span className="ml-2 font-medium">{formatFileSize(totalCompressedSize)}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-600">Space saved:</span>
          <span className="ml-2 font-medium text-green-600">
            {formatFileSize(totalSavedBytes)}
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-600">Formats used:</span>
          <div className="ml-2 flex space-x-1">
            {formats.map(format => (
              <Badge key={format} variant="outline" className="text-xs">
                {format.replace('image/', '').toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
