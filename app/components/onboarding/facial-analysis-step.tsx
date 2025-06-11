"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { OnboardingData } from "../../onboarding/page"

interface FacialAnalysisStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

export default function FacialAnalysisStep({ data, onUpdate, onValidationChange }: FacialAnalysisStepProps) {
  const [facialIntensity, setFacialIntensity] = useState<"strong" | "light" | "medium" | "">(data.facialIntensity || "")
  const [facialLines, setFacialLines] = useState<"straight" | "curved" | "">(data.facialLines || "")
  const [facialMaturity, setFacialMaturity] = useState<"mature" | "youthful" | "">(data.facialMaturity || "")

  // Memoize validation and update functions
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">面容结构判断</h2>
        <p className="text-gray-600">帮助系统准确映射到12种面容风格类型</p>
      </div>

      {/* AI Analysis Display */}
      {data.aiAnalysis && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">🤖 AI初步分析</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">脸型:</span>
              <span className="ml-2 font-medium">{data.aiAnalysis.faceShape}</span>
            </div>
            <div>
              <span className="text-gray-600">肤色:</span>
              <span className="ml-2 font-medium">{data.aiAnalysis.skinTone}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Facial Intensity */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎭 你觉得你的五官量感是：</h3>
        <p className="text-sm text-gray-600 mb-4">五官的立体度和存在感</p>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setFacialIntensity("strong")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialIntensity === "strong" ? "bg-red-100 border-red-300 text-red-700" : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">🔥</span>
                <span className="font-medium">浓颜</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">五官立体深邃，存在感强</p>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => setFacialIntensity("medium")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialIntensity === "medium"
                ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">⚖️</span>
                <span className="font-medium">中间</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">五官适中，不浓不淡</p>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => setFacialIntensity("light")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialIntensity === "light"
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">🌸</span>
                <span className="font-medium">淡颜</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">五官清淡柔和，温柔感</p>
            </div>
          </Button>
        </div>
      </Card>

      {/* Facial Lines */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">📐 面部线条更偏：</h3>
        <p className="text-sm text-gray-600 mb-4">整体轮廓和线条感</p>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setFacialLines("straight")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialLines === "straight" ? "bg-gray-100 border-gray-300 text-gray-700" : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">📏</span>
                <span className="font-medium">直线（冷调感）</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">轮廓分明，线条硬朗</p>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => setFacialLines("curved")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialLines === "curved" ? "bg-pink-100 border-pink-300 text-pink-700" : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">🌙</span>
                <span className="font-medium">曲线（亲和感）</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">轮廓柔和，线条圆润</p>
            </div>
          </Button>
        </div>
      </Card>

      {/* Facial Maturity */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">👶 面部成熟度更偏：</h3>
        <p className="text-sm text-gray-600 mb-4">整体给人的年龄感和气质</p>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setFacialMaturity("mature")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialMaturity === "mature"
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">👑</span>
                <span className="font-medium">成熟感</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">气质沉稳，有阅历感</p>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => setFacialMaturity("youthful")}
            className={`w-full justify-start text-sm p-4 h-auto ${
              facialMaturity === "youthful"
                ? "bg-green-100 border-green-300 text-green-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <div className="text-left">
              <div className="flex items-center">
                <span className="mr-2 text-lg">🌱</span>
                <span className="font-medium">幼态感</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">显年轻，有少女感</p>
            </div>
          </Button>
        </div>
      </Card>

      {/* Help Tips */}
      <Card className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
        <div className="text-center">
          <p className="text-orange-800 font-medium">💡 判断小贴士</p>
          <p className="text-sm text-orange-700 mt-1">可以对着镜子或照片仔细观察，也可以想想别人通常如何形容你的长相</p>
        </div>
      </Card>
    </div>
  )
}
