'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SmartImageUploader, CompressionStats } from '@/components/smart-image-uploader';
import { CompressedImageResult } from '@/lib/image-compression';

export default function TestCompressionPage() {
  const [results, setResults] = useState<CompressedImageResult[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<'chat' | 'thumbnail' | 'preview' | 'highQuality'>('chat');

  const handleImageSelect = (result: CompressedImageResult) => {
    setResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const downloadImage = (result: CompressedImageResult, index: number) => {
    const link = document.createElement('a');
    link.href = result.dataUrl;
    link.download = `compressed-image-${index + 1}.${result.format.split('/')[1]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const presetDescriptions = {
    chat: '聊天图片 - 平衡质量和速度 (800x600, 80%)',
    thumbnail: '缩略图 - 优先速度 (200x200, 70%)',
    preview: '预览图 - 极限压缩 (100x100, 60%)',
    highQuality: '高质量 - 用于重要图片 (1200x1200, 90%)'
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">智能图像压缩测试</h1>
            <p className="text-gray-600 mt-1">测试不同压缩预设的效果</p>
          </div>
        </div>

        {/* Preset Selection */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">选择压缩预设</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(presetDescriptions).map(([preset, description]) => (
              <div
                key={preset}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedPreset === preset
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => setSelectedPreset(preset as any)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{preset.toUpperCase()}</h3>
                  {selectedPreset === preset && (
                    <Badge variant="default">已选择</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Upload Area */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">上传测试图片</h2>
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearResults}
                className="text-gray-600"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                清空结果
              </Button>
            )}
          </div>

          <SmartImageUploader
            onImageSelect={handleImageSelect}
            preset={selectedPreset}
            maxFiles={5}
            showPreview={false}
            showCompressionStats={true}
          />
        </Card>

        {/* Compression Statistics */}
        {results.length > 0 && (
          <CompressionStats results={results} />
        )}

        {/* Results Display */}
        {results.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">压缩结果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="aspect-square">
                    <img
                      src={result.dataUrl}
                      alt={`压缩结果 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Format and Dimensions */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {result.format.replace('image/', '').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {result.dimensions.width}×{result.dimensions.height}
                      </span>
                    </div>

                    {/* File Size */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">原始大小:</span>
                        <span className="font-medium">{formatFileSize(result.originalSize)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">压缩后:</span>
                        <span className="font-medium text-green-600">
                          {formatFileSize(result.compressedSize)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">压缩率:</span>
                        <span className="font-medium text-blue-600">
                          {(result.compressionRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">处理时间:</span>
                        <span className="font-medium">
                          {result.processingTime.toFixed(0)}ms
                        </span>
                      </div>
                    </div>

                    {/* Download Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => downloadImage(result, index)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载压缩图片
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Usage Instructions */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">使用说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h3 className="font-medium mb-2">📈 压缩效果</h3>
              <ul className="space-y-1">
                <li>• AVIF: 最高压缩率 (~50%)</li>
                <li>• WebP: 良好压缩率 (~25-35%)</li>
                <li>• JPEG: 标准压缩率 (基准)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">🎯 预设建议</h3>
              <ul className="space-y-1">
                <li>• Chat: 日常聊天图片</li>
                <li>• Thumbnail: 图片列表缩略图</li>
                <li>• Preview: 快速预览图</li>
                <li>• High Quality: 重要展示图片</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Browser Support Info */}
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <h3 className="font-medium text-yellow-800 mb-2">🔧 浏览器兼容性</h3>
          <p className="text-sm text-yellow-700">
            系统会自动检测浏览器支持的格式。如果不支持AVIF或WebP，会自动回退到JPEG格式。
            现代浏览器通常支持WebP (96%+)，AVIF支持率约93%。
          </p>
        </Card>
      </div>
    </div>
  );
}