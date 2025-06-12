"use client"

import { useState, useEffect, useCallback } from "react"
import { OnboardingData } from "@/lib/onboarding-storage"
import { Info } from "lucide-react"

interface FacialAnalysisStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

// Helper component for consistent option buttons
const OptionButton = ({ label, emoji, isSelected, onClick }: any) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 px-4 py-2 text-sm border rounded-full transition-all duration-200
        flex items-center justify-center space-x-2
        ${isSelected
          ? "bg-pink-500 border-pink-500 text-white shadow-md"
          : "bg-white border-gray-300 text-gray-700 hover:border-pink-400 hover:text-pink-600"
        }
      `}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  )
}

export default function FacialAnalysisStep({ data, onUpdate, onValidationChange }: FacialAnalysisStepProps) {
  const [facialIntensity, setFacialIntensity] = useState(data.facialIntensity || "")
  const [facialLines, setFacialLines] = useState(data.facialLines || "")
  const [facialMaturity, setFacialMaturity] = useState(data.facialMaturity || "")

  const validateAndUpdate = useCallback(() => {
    const isValid = facialIntensity !== "" && facialLines !== "" && facialMaturity !== ""
    onValidationChange(isValid)
    onUpdate({
      facialIntensity: facialIntensity as "strong" | "light" | "medium" | undefined,
      facialLines: facialLines as "straight" | "curved" | undefined,
      facialMaturity: facialMaturity as "mature" | "youthful" | undefined,
    })
  }, [facialIntensity, facialLines, facialMaturity, onUpdate, onValidationChange])

  useEffect(() => {
    validateAndUpdate()
  }, [validateAndUpdate])

  const facialIntensityOptions = [
    { id: "strong", label: "浓颜", emoji: "🔥" },
    { id: "medium", label: "中间", emoji: "⚖️" },
    { id: "light", label: "淡颜", emoji: "🌸" },
  ]

  const facialLinesOptions = [
    { id: "straight", label: "直线", emoji: "📏" },
    { id: "curved", label: "曲线", emoji: "🌙" },
  ]

  const facialMaturityOptions = [
    { id: "mature", label: "成熟", emoji: "👑" },
    { id: "youthful", label: "幼态", emoji: "🌱" },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Information Hierarchy */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">面容结构判断</h2>
        <p className="text-sm text-gray-500 mt-1">请根据你的直观感受，选择最符合的描述</p>
      </div>

      {/* Unified Modules */}
      <div className="space-y-5">
        {/* Facial Intensity */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">🎭 五官量感</h3>
          <div className="flex flex-wrap gap-3">
            {facialIntensityOptions.map(opt => (
              <OptionButton key={opt.id} {...opt} isSelected={facialIntensity === opt.id} onClick={() => setFacialIntensity(opt.id)} />
            ))}
          </div>
        </div>

        {/* Facial Lines */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">📐 面部线条</h3>
          <div className="flex flex-wrap gap-3">
            {facialLinesOptions.map(opt => (
              <OptionButton key={opt.id} {...opt} isSelected={facialLines === opt.id} onClick={() => setFacialLines(opt.id)} />
            ))}
          </div>
        </div>

        {/* Facial Maturity */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">👶 成熟度</h3>
          <div className="flex flex-wrap gap-3">
            {facialMaturityOptions.map(opt => (
              <OptionButton key={opt.id} {...opt} isSelected={facialMaturity === opt.id} onClick={() => setFacialMaturity(opt.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* 5. Modernized Tips */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start text-gray-600">
          <Info className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs">
            不确定如何选择？可以拿着镜子观察，或者回忆一下朋友们通常如何评价你的长相。
          </p>
        </div>
      </div>
    </div>
  )
}
