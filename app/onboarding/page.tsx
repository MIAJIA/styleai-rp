"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Import step components
import PhotoUploadStep from "../components/onboarding/photo-upload-step"
import BodyAnalysisStep from "../components/onboarding/body-analysis-step"
import FacialAnalysisStep from "../components/onboarding/facial-analysis-step"
import StylePreferenceStep from "../components/onboarding/style-preference-step"
import ScenarioStep from "../components/onboarding/scenario-step"
import StyleBoundariesStep from "../components/onboarding/style-boundaries-step"
import StyleSummaryStep from "../components/onboarding/style-summary-step"

export interface OnboardingData {
  // Step 0: Photo Upload
  fullBodyPhoto?: string
  headPhoto?: string
  aiAnalysis?: {
    bodyType?: string
    faceShape?: string
    skinTone?: string
    proportions?: string
    styleInitialSense?: string
    bodyAdvantages?: string[]
    boneStructure?: string
    facialFeatures?: string
  }

  // Step 1: Body Analysis
  bodyAdvantages?: string[]
  bodyChallenges?: string[]
  customAdvantages?: string
  customChallenges?: string
  boneStructure?: "strong" | "delicate" // 骨架感强/弱
  upperBodyType?: "straight" | "curved" // 纸片感/圆润感

  // Step 1.5: Facial Analysis
  facialIntensity?: "strong" | "light" | "medium" // 浓颜/淡颜/中间
  facialLines?: "straight" | "curved" // 直线/曲线
  facialMaturity?: "mature" | "youthful" // 成熟感/幼态感

  // Step 2: Style Preferences
  stylePreferences?: string[]
  customStyle?: string

  // Step 3: Scenario
  primaryScenario?: string
  customScenario?: string

  // Step 4: Style Boundaries
  avoidElements?: string[]
  customAvoid?: string

  // Step 5: Style Summary (generated)
  styleProfile?: {
    structureCombination?: string
    styleLabels?: string[]
    recommendedKeywords?: string[]
  }
}

const TOTAL_STEPS = 7

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [isStepValid, setIsStepValid] = useState(false)
  const router = useRouter()

  // Load saved data on mount
  useEffect(() => {
    const savedData = localStorage.getItem("styleMe_onboarding_data")
    if (savedData) {
      try {
        setOnboardingData(JSON.parse(savedData))
      } catch (error) {
        console.error("Error loading onboarding data:", error)
      }
    }
  }, [])

  // Save data whenever it changes
  useEffect(() => {
    localStorage.setItem("styleMe_onboarding_data", JSON.stringify(onboardingData))
  }, [onboardingData])

  // Memoize the update callback to prevent infinite re-renders
  const updateOnboardingData = useCallback((stepData: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...stepData }))
  }, [])

  // Memoize the validation callback to prevent infinite re-renders
  const handleValidationChange = useCallback((isValid: boolean) => {
    setIsStepValid(isValid)
  }, [])

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      // Complete onboarding
      localStorage.setItem("styleMe_onboarding_completed", "true")
      localStorage.setItem("styleMe_user_profile", JSON.stringify(onboardingData))
      router.push("/")
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSkip = () => {
    // Allow skipping for optional steps (5 and 6)
    if (currentStep >= 5) {
      handleNext()
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PhotoUploadStep data={onboardingData} onUpdate={updateOnboardingData} onValidationChange={handleValidationChange} />
        )
      case 1:
        return (
          <BodyAnalysisStep data={onboardingData} onUpdate={updateOnboardingData} onValidationChange={handleValidationChange} />
        )
      case 2:
        return (
          <FacialAnalysisStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onValidationChange={handleValidationChange}
          />
        )
      case 3:
        return (
          <StylePreferenceStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onValidationChange={handleValidationChange}
          />
        )
      case 4:
        return (
          <ScenarioStep data={onboardingData} onUpdate={updateOnboardingData} onValidationChange={handleValidationChange} />
        )
      case 5:
        return (
          <StyleBoundariesStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onValidationChange={handleValidationChange}
          />
        )
      case 6:
        return (
          <StyleSummaryStep data={onboardingData} onUpdate={updateOnboardingData} onValidationChange={handleValidationChange} />
        )
      default:
        return null
    }
  }

  const getStepTitle = () => {
    const titles = [
      "照片上传", // Step 0
      "身体结构识别", // Step 1
      "面容结构判断", // Step 1.5
      "风格偏好选择", // Step 2
      "使用场景", // Step 3
      "风格边界", // Step 4
      "风格总结", // Step 5
    ]
    return titles[currentStep]
  }

  const getStepEmoji = () => {
    const emojis = ["📸", "💪", "👩‍🎨", "🎨", "🎯", "🚫", "✨"]
    return emojis[currentStep]
  }

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-pink-100">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="p-2 h-auto"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <span className="text-xl">{getStepEmoji()}</span>
                <h1 className="text-lg font-semibold text-gray-800">{getStepTitle()}</h1>
              </div>
              <p className="text-sm text-gray-500">
                第 {currentStep + 1} 步，共 {TOTAL_STEPS} 步
              </p>
            </div>

            {currentStep >= 5 && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-gray-500 text-sm">
                跳过
              </Button>
            )}
            {currentStep < 5 && <div className="w-12"></div>}
          </div>

          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-md mx-auto">{renderCurrentStep()}</div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-pink-100 p-6">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleNext}
            disabled={!isStepValid && currentStep < 5}
            className="w-full h-12 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
          >
            <span className="flex items-center justify-center space-x-2">
              <span>{currentStep === TOTAL_STEPS - 1 ? "完成设置" : "继续"}</span>
              {currentStep < TOTAL_STEPS - 1 && <ChevronRight className="w-4 h-4" />}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
