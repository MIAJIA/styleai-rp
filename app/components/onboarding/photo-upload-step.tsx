"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, CheckCircle } from "lucide-react";
import { OnboardingData } from "@/lib/onboarding-storage";

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
  const [headPhoto, setHeadPhoto] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fullBodyInputRef = useRef<HTMLInputElement>(null);
  const headPhotoInputRef = useRef<HTMLInputElement>(null);

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

    if (data.headPhoto) {
      setHeadPhoto(data.headPhoto);
    } else {
      // Try to load from separate localStorage
      const savedHeadPhoto = localStorage.getItem("styleMe_headPhoto");
      if (savedHeadPhoto) {
        setHeadPhoto(savedHeadPhoto);
      }
    }

    // Check if analysis was already completed
    if (data.aiAnalysis) {
      setAnalysisComplete(true);
    }
  }, [data.fullBodyPhoto, data.headPhoto, data.aiAnalysis]);

  // New function to call the backend API for analysis
  const runAIAnalysis = useCallback(async () => {
    if (isAnalyzing || analysisComplete || !fullBodyPhoto || !headPhoto) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze-photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullBodyPhoto, headPhoto }),
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
        "Sorry, we couldn't analyze the photos. Please try again or use different images.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [fullBodyPhoto, headPhoto, onUpdate, isAnalyzing, analysisComplete]);

  // Handle validation and trigger analysis
  useEffect(() => {
    const isValid = Boolean(fullBodyPhoto && headPhoto);
    onValidationChange(isValid);

    // Automatically trigger analysis once both photos are uploaded and there's no error
    if (isValid && !analysisComplete && !isAnalyzing && !analysisError) {
      runAIAnalysis();
    }
  }, [
    fullBodyPhoto,
    headPhoto,
    onValidationChange,
    analysisComplete,
    isAnalyzing,
    analysisError,
    runAIAnalysis,
  ]);

  // Update parent data when photos change
  useEffect(() => {
    if (fullBodyPhoto || headPhoto) {
      onUpdate({
        fullBodyPhoto,
        headPhoto,
      });
    }
  }, [fullBodyPhoto, headPhoto, onUpdate]);

  // Helper: compress image to dataURL (JPEG) to fit localStorage quota
  const compressImageToDataUrl = async (
    file: File,
    maxWidth = 1000,
    quality = 0.75,
  ): Promise<string> => {
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

  const handleFileUpload = async (file: File, type: "fullBody" | "head") => {
    try {
      const result = await compressImageToDataUrl(file);

      // Reset the analysis state when a new photo is uploaded
      setAnalysisComplete(false);
      setAnalysisError(null);

      if (type === "fullBody") {
        setFullBodyPhoto(result);
        try {
          localStorage.setItem("styleMe_fullBodyPhoto", result);
        } catch (error) {
          console.warn("Failed to save full body photo to localStorage:", error);
        }
      } else {
        setHeadPhoto(result);
        try {
          localStorage.setItem("styleMe_headPhoto", result);
        } catch (error) {
          console.warn("Failed to save head photo to localStorage:", error);
        }
      }
    } catch (err) {
      console.error("Error processing image:", err);
      setAnalysisError("Failed to process image. Please try another photo.");
    }
  };

  const removePhoto = (type: "fullBody" | "head") => {
    if (type === "fullBody") {
      setFullBodyPhoto("");
      localStorage.removeItem("styleMe_fullBodyPhoto");
    } else {
      setHeadPhoto("");
      localStorage.removeItem("styleMe_headPhoto");
    }
    // Reset the analysis state
    setAnalysisComplete(false);
    setAnalysisError(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Let's Get to Know You</h2>
        <p className="text-gray-600">
          Upload your photos so our AI can analyze your unique features and create personalized
          recommendations.
        </p>
      </div>

      {/* Photo Upload Cards */}
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
              <div
                onClick={() => fullBodyInputRef.current?.click()}
                className="border-2 border-dashed border-pink-200 rounded-xl p-8 text-center cursor-pointer hover:border-pink-300 transition-colors"
              >
                <Camera className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Tap to upload full body photo</p>
                <p className="text-xs text-gray-400">Best in fitted clothing or swimwear</p>
              </div>
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
                  onClick={() => removePhoto("fullBody")}
                  className="absolute top-2 right-2 w-8 h-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <input
              ref={fullBodyInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, "fullBody");
              }}
            />
          </div>
        </Card>

        {/* Head Photo */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Head & Shoulders Photo</h3>
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">
                Required
              </span>
            </div>

            {!headPhoto ? (
              <div
                onClick={() => headPhotoInputRef.current?.click()}
                className="border-2 border-dashed border-pink-200 rounded-xl p-8 text-center cursor-pointer hover:border-pink-300 transition-colors"
              >
                <Camera className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Tap to upload head photo</p>
                <p className="text-xs text-gray-400">For face shape & style analysis</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={headPhoto || "/placeholder.svg"}
                  alt="Head photo"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removePhoto("head")}
                  className="absolute top-2 right-2 w-8 h-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <input
              ref={headPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, "head");
              }}
            />
          </div>
        </Card>
      </div>

      {/* AI Analysis Status */}
      {fullBodyPhoto && headPhoto && (
        <Card className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
          <div className="flex items-center space-x-3">
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-pink-700 font-medium">AI is analyzing your photos...</p>
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
                <div>
                  <span className="text-gray-600">Skin Tone:</span>
                  <span className="ml-2 font-medium">{data.aiAnalysis.skinTone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Proportions:</span>
                  <span className="ml-2 font-medium">{data.aiAnalysis.proportions}</span>
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
        </ul>
      </Card>
    </div>
  );
}
