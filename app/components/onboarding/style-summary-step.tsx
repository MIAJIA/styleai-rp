"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { OnboardingData } from "../../onboarding/page"

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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">风格总结</h2>
        <p className="text-gray-600">基于你的信息，我们为你生成了专属的风格档案</p>
      </div>

      {isGenerating ? (
        <Card className="p-6 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <p className="font-semibold text-pink-800">正在分析你的风格...</p>
              <p className="text-sm text-pink-600">AI正在整合你的所有信息</p>
            </div>
          </div>
        </Card>
      ) : styleProfile ? (
        <>
          {/* Structure Combination */}
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">🧬 结构组合识别</h3>
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-900">{styleProfile.structureCombination}</span>
            </div>
          </Card>

          {/* Style Labels */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">🏷️ 风格标签</h3>
            <div className="flex flex-wrap gap-2">
              {styleProfile.styleLabels.map((label, index) => (
                <Badge key={index} variant="secondary" className="bg-pink-100 text-pink-800 border-pink-200">
                  {label}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Recommended Keywords */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">💡 推荐关键词</h3>
            <div className="grid grid-cols-2 gap-2">
              {styleProfile.recommendedKeywords.map((keyword, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-lg p-3 text-center"
                >
                  <span className="text-sm font-medium text-rose-800">{keyword}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Personal Summary */}
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-2">✨ 你的风格总结</h3>
            <p className="text-sm text-purple-700">
              你是一个 <strong>{styleProfile.structureCombination}</strong> 的{" "}
              <strong>{styleProfile.styleLabels.join("、")}</strong> 类型。我们建议你在穿搭中多运用{" "}
              <strong>{styleProfile.recommendedKeywords.slice(0, 3).join("、")}</strong>{" "}
              等元素，这样能最好地展现你的个人魅力。
            </p>
          </Card>

          {/* User Data Summary */}
          <Card className="p-4 bg-gray-50 border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">📋 你的偏好回顾</h3>
            <div className="space-y-2 text-sm">
              {data.stylePreferences && data.stylePreferences.length > 0 && (
                <div>
                  <span className="text-gray-600">喜欢的风格：</span>
                  <span className="ml-2 font-medium">{data.stylePreferences.join("、")}</span>
                </div>
              )}
              {data.primaryScenario && (
                <div>
                  <span className="text-gray-600">主要场景：</span>
                  <span className="ml-2 font-medium">
                    {data.primaryScenario === "work"
                      ? "工作职场"
                      : data.primaryScenario === "casual"
                        ? "日常休闲"
                        : data.primaryScenario === "date"
                          ? "约会社交"
                          : data.primaryScenario === "special"
                            ? "特殊活动"
                            : data.primaryScenario === "travel"
                              ? "旅行度假"
                              : data.primaryScenario === "creative"
                                ? "创意表达"
                                : data.primaryScenario}
                  </span>
                </div>
              )}
              {data.bodyAdvantages && data.bodyAdvantages.length > 0 && (
                <div>
                  <span className="text-gray-600">身体优势：</span>
                  <span className="ml-2 font-medium">{data.bodyAdvantages.join("、")}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Ready Message */}
          <Card className="p-6 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 border-pink-200">
            <div className="text-center space-y-3">
              <div className="text-4xl">🎉</div>
              <h3 className="text-xl font-bold text-gray-800">风格档案已生成！</h3>
              <p className="text-gray-600">
                现在你可以开始探索专属于你的完美造型了。我们的AI造型师已经准备好为你创造惊艳的搭配！
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 mt-4">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>照片已分析</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>偏好已设定</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>风格已生成</span>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
