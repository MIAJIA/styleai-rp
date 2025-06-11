"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, X, CheckCircle } from "lucide-react"
import type { OnboardingData } from "../../onboarding/page"

interface PhotoUploadStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

export default function PhotoUploadStep({ data, onUpdate, onValidationChange }: PhotoUploadStepProps) {
  const [fullBodyPhoto, setFullBodyPhoto] = useState<string>(data.fullBodyPhoto || "")
  const [headPhoto, setHeadPhoto] = useState<string>(data.headPhoto || "")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  const fullBodyInputRef = useRef<HTMLInputElement>(null)
  const headPhotoInputRef = useRef<HTMLInputElement>(null)

  // Memoize the AI analysis function
  const simulateAIAnalysis = useCallback(async () => {
    if (isAnalyzing || analysisComplete) return

    setIsAnalyzing(true)

    // Simulate AI analysis delay
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const mockAnalysis = {
      bodyType: "Hourglass",
      faceShape: "Oval",
      skinTone: "Warm",
      proportions: "Balanced",
      styleInitialSense: "Classic with modern touches",
      bodyAdvantages: ["Well-defined waist", "Balanced proportions", "Long legs"],
    }

    onUpdate({
      fullBodyPhoto,
      headPhoto,
      aiAnalysis: mockAnalysis,
    })

    setIsAnalyzing(false)
    setAnalysisComplete(true)
  }, [fullBodyPhoto, headPhoto, onUpdate, isAnalyzing, analysisComplete])

  // Handle validation
  useEffect(() => {
    const isValid = Boolean(fullBodyPhoto && headPhoto)
    onValidationChange(isValid)

    if (isValid && !analysisComplete && !isAnalyzing) {
      simulateAIAnalysis()
    }
  }, [fullBodyPhoto, headPhoto, onValidationChange, analysisComplete, isAnalyzing, simulateAIAnalysis])

  const handleFileUpload = (file: File, type: "fullBody" | "head") => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (type === "fullBody") {
        setFullBodyPhoto(result)
      } else {
        setHeadPhoto(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (type: "fullBody" | "head") => {
    if (type === "fullBody") {
      setFullBodyPhoto("")
    } else {
      setHeadPhoto("")
    }
    setAnalysisComplete(false)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Let's Get to Know You</h2>
        <p className="text-gray-600">
          Upload your photos so our AI can analyze your unique features and create personalized recommendations.
        </p>
      </div>

      {/* Photo Upload Cards */}
      <div className="space-y-4">
        {/* Full Body Photo */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Full Body Photo</h3>
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">Required</span>
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
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, "fullBody")
              }}
            />
          </div>
        </Card>

        {/* Head Photo */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Head & Shoulders Photo</h3>
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">Required</span>
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
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, "head")
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
                <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <p className="font-semibold text-pink-800">Analyzing your photos...</p>
                  <p className="text-sm text-pink-600">Our AI is identifying your unique features</p>
                </div>
              </>
            ) : analysisComplete ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div>
                  <p className="font-semibold text-green-800">Analysis complete!</p>
                  <p className="text-sm text-green-600">Ready to personalize your style</p>
                </div>
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
  )
}
