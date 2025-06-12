"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { OnboardingData } from "@/lib/onboarding-storage"

interface StyleSummaryStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

export default function StyleSummaryStep({ data, onUpdate, onValidationChange }: StyleSummaryStepProps) {
  const [styleProfile, setStyleProfile] = useState(data.styleProfile || null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate style profile based on collected data
  const generateStyleProfile = useCallback(() => {
    if (styleProfile || isGenerating) return

    setIsGenerating(true)

    // Simulate analysis delay
    setTimeout(() => {
      const profile = {
        structureCombination: generateStructureCombination(),
        styleLabels: generateStyleLabels(),
        recommendedKeywords: generateRecommendedKeywords(),
      }

      setStyleProfile(profile)
      onUpdate({ styleProfile: profile })
      setIsGenerating(false)
    }, 2000)
  }, [styleProfile, isGenerating, onUpdate])

  const generateStructureCombination = () => {
    const bone = data.boneStructure === "strong" ? "大骨架" : data.boneStructure === "delicate" ? "小骨架" : "中等骨架"
    const body = data.upperBodyType === "straight" ? "直身" : data.upperBodyType === "curved" ? "圆身" : "中等身形"
    const face = data.facialIntensity === "strong" ? "浓颜" : data.facialIntensity === "light" ? "淡颜" : "中等颜值"

    return `${bone} × ${body} × ${face}`
  }

  const generateStyleLabels = () => {
    const labels = []

    // Based on facial analysis
    if (data.facialIntensity === "strong" && data.facialMaturity === "youthful") {
      labels.push("甜酷少女脸")
    } else if (data.facialIntensity === "light" && data.facialLines === "curved") {
      labels.push("温柔淡颜")
    } else if (data.facialMaturity === "mature" && data.facialLines === "straight") {
      labels.push("高级冷艳")
    }

    // Based on style preferences
    if (data.stylePreferences?.includes("elegant")) {
      labels.push("优雅知性")
    }
    if (data.stylePreferences?.includes("cool")) {
      labels.push("酷感时尚")
    }
    if (data.stylePreferences?.includes("fresh")) {
      labels.push("清新活力")
    }

    // Based on scenario
    if (data.primaryScenario === "work") {
      labels.push("职场精英")
    } else if (data.primaryScenario === "casual") {
      labels.push("日常舒适")
    }

    return labels.length > 0 ? labels : ["个性独特", "风格多元"]
  }

  const generateRecommendedKeywords = () => {
    const keywords = []

    // Based on body advantages
    if (data.bodyAdvantages?.includes("腰细")) {
      keywords.push("高腰线")
    }
    if (data.bodyAdvantages?.includes("腿长")) {
      keywords.push("短上衣")
    }

    // Based on style preferences
    if (data.stylePreferences?.includes("minimalist")) {
      keywords.push("简约线条", "中性色调")
    }
    if (data.stylePreferences?.includes("elegant")) {
      keywords.push("精致细节", "优雅剪裁")
    }
    if (data.stylePreferences?.includes("fresh")) {
      keywords.push("明亮色彩", "轻盈面料")
    }

    // Based on facial analysis
    if (data.facialIntensity === "strong") {
      keywords.push("简洁设计")
    } else if (data.facialIntensity === "light") {
      keywords.push("精致装饰")
    }

    return keywords.length > 0 ? keywords : ["个性表达", "舒适自在", "时尚前沿"]
  }

  useEffect(() => {
    onValidationChange(true) // This step is always valid
    generateStyleProfile()
  }, [onValidationChange, generateStyleProfile])

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      {isGenerating ? (
        <div className="text-center space-y-4 p-6 bg-white/50 rounded-lg">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <p className="font-semibold text-pink-800">正在生成你的风格档案...</p>
            <p className="text-sm text-pink-600">AI正在整合你的所有信息</p>
          </div>
        </div>
      ) : styleProfile ? (
        <div className="text-center space-y-4 p-6">
          <div className="text-6xl animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800">风格档案已生成！</h2>
        </div>
      ) : null}
    </div>
  )
}
