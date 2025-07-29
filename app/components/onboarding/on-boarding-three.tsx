"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, X, CheckCircle, Info, Loader2 } from "lucide-react";
import { OnboardingData } from "@/lib/onboarding-storage";
import { useImageCompression } from "@/lib/hooks/use-image-compression";
import { StepProps } from "./on-boarding-step";

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


export default function OnBoardingThree({ data,
    onUpdate,
    onValidationChange,
}: StepProps) {
    const [useSmartUploader, setUseSmartUploader] = useState(true);
    const fullBodyInputRef = useRef<HTMLInputElement>(null);
    const [fullBodyPhoto, setFullBodyPhoto] = useState<string>("");


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
    }, [data.fullBodyPhoto, data.aiAnalysis]);



    // Handle validation and trigger analysis
    useEffect(() => {
        const isValid = Boolean(fullBodyPhoto);
        onValidationChange(isValid);
    }, [
        fullBodyPhoto,
        onValidationChange,
    ]);

    // Update parent data when photo changes
    useEffect(() => {
        if (fullBodyPhoto) {
            onUpdate({
                fullBodyPhoto,
            });
        }
    }, [fullBodyPhoto, onUpdate]);


    const compressImageToDataUrl = async (
        file: File,
        maxWidth = 1000,
        quality = 0.75,
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


            setFullBodyPhoto(result);
            try {
                localStorage.setItem("styleMe_fullBodyPhoto", result);
            } catch (error) {
                console.warn("Failed to save full body photo to localStorage:", error);
            }
        } catch (err) {
            console.error("Error processing image:", err);
        }
    };

    // Handle smart uploader result
    const handleSmartUploaderResult = (result: any) => {
        // Reset the analysis state when a new photo is uploaded

        setFullBodyPhoto(result.dataUrl);
        try {
            localStorage.setItem("styleMe_fullBodyPhoto", result.dataUrl);
            // save to idols
            const newPortrait = { id: `portrait-${Date.now()}`, imageSrc: result.dataUrl };
            const MY_PHOTOS_STORAGE_KEY = "styleai_portraits";
            const storedIdols = window.localStorage.getItem(MY_PHOTOS_STORAGE_KEY)
            const idols = storedIdols ? JSON.parse(storedIdols) : [];
            idols.push(newPortrait);
            window.localStorage.setItem(MY_PHOTOS_STORAGE_KEY, JSON.stringify(idols));
        } catch (error) {
            console.warn("Failed to save full body photo to localStorage:", error);
        }
    };

    const removePhoto = () => {
        setFullBodyPhoto("");
        localStorage.removeItem("styleMe_fullBodyPhoto");
        // Reset the analysis state
    };


    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    Upload a photo of you
                </h2>
                <p className="text-gray-600">
                    to build personalized style profile
                </p>
            </div>
            {/* Upload Mode Toggle */}
            {/* <Card className="p-3 bg-blue-50 border-blue-200">
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
            </Card> */}


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
                                    className="w-full h-48 object-cover object-top rounded-xl"
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

        </div>
    )
}