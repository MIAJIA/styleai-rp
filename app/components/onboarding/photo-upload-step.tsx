"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, CheckCircle, Info, Loader2 } from "lucide-react";
import { OnboardingData } from "@/lib/onboarding-storage";
import { useImageCompression } from "@/lib/hooks/use-image-compression";

// Dynamically import SmartImageUploader to prevent SSR issues
const SmartImageUploader = dynamic(
  () => import('@/components/smart-image-uploader').then(mod => ({ default: mod.SmartImageUploader })),
  {
    ssr: false,
    loading: () => (
      <Card className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
        <p className="text-sm text-gray-600">Loading uploader...</p>
      </Card>
    )
  }
);

interface PhotoUploadStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function PhotoUploadStep({
  data,
  onUpdate,
  onValidationChange,
}: PhotoUploadStepProps) {
  const [fullBodyPhoto, setFullBodyPhoto] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [useSmartUploader, setUseSmartUploader] = useState(true);

  const fullBodyInputRef = useRef<HTMLInputElement>(null);

  // Load photos from data or separate localStorage on mount
  useEffect(() => {
    // Try to load from data first
    if (data.fullBodyPhoto) {
      setFullBodyPhoto(data.fullBodyPhoto);
    } else {
      // Try to load from separate localStorage
      const savedFullBodyPhoto = localStorage.getItem("styleMe_fullBodyPhoto");
      if (savedFullBodyPhoto) {
        setFullBodyPhoto(savedFullBodyPhoto);
      }
    }

    // Check if analysis was already completed
    if (data.aiAnalysis) {
      setAnalysisComplete(true);
    }
  }, [data.fullBodyPhoto, data.aiAnalysis]);

  // New function to call the backend API for analysis
  const runAIAnalysis = useCallback(async () => {
    if (isAnalyzing || analysisComplete || !fullBodyPhoto) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze-photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullBodyPhoto }),
      });

      if (!response.ok) {
        throw new Error("Failed to get analysis from server.");
      }

      const result = await response.json();

      if (result.aiAnalysis) {
        onUpdate({
          aiAnalysis: result.aiAnalysis,
        });
        setAnalysisComplete(true);
      } else {
        throw new Error("Invalid analysis data received.");
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAnalysisError(
        "Sorry, we couldn't analyze the photo. Please try again or use a different image.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [fullBodyPhoto, onUpdate, isAnalyzing, analysisComplete]);

  // Handle validation and trigger analysis
  useEffect(() => {
    const isValid = Boolean(fullBodyPhoto);
    onValidationChange(isValid);

    // Automatically trigger analysis once photo is uploaded and there's no error
    if (isValid && !analysisComplete && !isAnalyzing && !analysisError) {
      runAIAnalysis();
    }
  }, [
    fullBodyPhoto,
    onValidationChange,
    analysisComplete,
    isAnalyzing,
    analysisError,
    runAIAnalysis,
  ]);

  // Update parent data when photo changes
  useEffect(() => {
    if (fullBodyPhoto) {
      onUpdate({
        fullBodyPhoto,
      });
    }
  }, [fullBodyPhoto, onUpdate]);

  // Helper: compress image to dataURL (JPEG) to fit localStorage quota
  const compressImageToDataUrl = async (
    file: File,
    maxWidth = 1000,
    quality = 0.60,
  ): Promise<string> => {
    // Only run on client side
    if (typeof window === 'undefined') {
      throw new Error('Image compression is only available on the client side');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(maxWidth / img.width, 1);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed"));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
              URL.revokeObjectURL(url);
            };
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleFileUpload = async (file: File) => {
    try {
      const result = await compressImageToDataUrl(file);

      // Reset the analysis state when a new photo is uploaded
      setAnalysisComplete(false);
      setAnalysisError(null);

      setFullBodyPhoto(result);
      try {
        localStorage.setItem("styleMe_fullBodyPhoto", result);
      } catch (error) {
        console.warn("Failed to save full body photo to localStorage:", error);
      }
    } catch (err) {
      console.error("Error processing image:", err);
      setAnalysisError("Failed to process image. Please try another photo.");
    }
  };

  // Handle smart uploader result
  const handleSmartUploaderResult = (result: any) => {
    // Reset the analysis state when a new photo is uploaded
    setAnalysisComplete(false);
    setAnalysisError(null);

    setFullBodyPhoto(result.dataUrl);
    try {
      localStorage.setItem("styleMe_fullBodyPhoto", result.dataUrl);
    } catch (error) {
      console.warn("Failed to save full body photo to localStorage:", error);
    }
  };

  const removePhoto = () => {
    setFullBodyPhoto("");
    localStorage.removeItem("styleMe_fullBodyPhoto");
    // Reset the analysis state
    setAnalysisComplete(false);
    setAnalysisError(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Let's Get to Know You</h2>
        <p className="text-gray-600">
          Upload your photo so our AI can analyze your unique features and create personalized
          recommendations.
        </p>
      </div>

      {/* Upload Mode Toggle */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">
              {useSmartUploader ? '智能压缩模式' : '标准模式'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUseSmartUploader(!useSmartUploader)}
            className="text-blue-600 border-blue-300 hover:bg-blue-100"
          >
            切换至{useSmartUploader ? '标准' : '智能'}模式
          </Button>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          {useSmartUploader
            ? '使用现代图像格式，更好的压缩效果和性能监控'
            : '使用传统JPEG压缩方式'}
        </p>
      </Card>

      {/* Photo Upload Card */}
      <div className="space-y-4">
        {/* Full Body Photo */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Full Body Photo</h3>
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">
                Required
              </span>
            </div>

            {!fullBodyPhoto ? (
              useSmartUploader ? (
                <SmartImageUploader
                  onImageSelect={handleSmartUploaderResult}
                  onError={(error) => setAnalysisError(error)}
                  preset="highQuality"
                  maxFiles={1}
                  showPreview={false}
                  showCompressionStats={true}
                />
              ) : (
                <div
                  onClick={() => fullBodyInputRef.current?.click()}
                  className="border-2 border-dashed border-pink-200 rounded-xl p-8 text-center cursor-pointer hover:border-pink-300 transition-colors"
                >
                  <Camera className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Tap to upload full body photo</p>
                  <p className="text-xs text-gray-400">Best in fitted clothing or swimwear</p>
                </div>
              )
            ) : (
              <div className="relative">
                <img
                  src={fullBodyPhoto || "/placeholder.svg"}
                  alt="Full body"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 w-8 h-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {!useSmartUploader && (
              <input
                ref={fullBodyInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            )}
          </div>
        </Card>
      </div>

      {/* AI Analysis Status */}
      {fullBodyPhoto && (
        <Card className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
          <div className="flex items-center space-x-3">
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-pink-700 font-medium">AI is analyzing your photo...</p>
              </>
            ) : analysisComplete ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-700 font-medium">
                  Analysis complete! You can proceed.
                </p>
              </>
            ) : analysisError ? (
              <>
                <X className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700 font-medium">{analysisError}</p>
              </>
            ) : null}
          </div>

          {analysisComplete && data.aiAnalysis && (
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-gray-800">Initial Analysis:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Body Type:</span>
                  <span className="ml-2 font-medium">{data.aiAnalysis.bodyType}</span>
                </div>
                <div>
                  <span className="text-gray-600">Face Shape:</span>
                  <span className="ml-2 font-medium">{data.aiAnalysis.faceShape}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Photo Tips */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">📸 Photo Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use good lighting (natural light works best)</li>
          <li>• Stand straight with arms at your sides</li>
          <li>• Wear fitted clothing to show your silhouette</li>
          <li>• Keep the background simple and uncluttered</li>
          {useSmartUploader && (
            <li>• 智能压缩将自动优化图片质量和文件大小</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
