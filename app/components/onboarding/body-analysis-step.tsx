"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OnboardingData } from "@/lib/onboarding-storage"

interface BodyAnalysisStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const BODY_ADVANTAGES = ["腿长", "腰细", "比例好", "肩颈线条好", "肩膀有型", "身材匀称"]

const BODY_CHALLENGES = ["胯宽", "腿短", "无腰线", "脖子短", "肩膀宽", "肩膀窄"]

export default function BodyAnalysisStep({ data, onUpdate, onValidationChange }: BodyAnalysisStepProps) {
  const [selectedAdvantages, setSelectedAdvantages] = useState<string[]>(data.bodyAdvantages || [])
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>(data.bodyChallenges || [])
  const [customAdvantages, setCustomAdvantages] = useState(data.customAdvantages || "")
  const [customChallenges, setCustomChallenges] = useState(data.customChallenges || "")
  const [boneStructure, setBoneStructure] = useState<"strong" | "delicate" | "">(data.boneStructure || "")
  const [upperBodyType, setUpperBodyType] = useState<"straight" | "curved" | "">(data.upperBodyType || "")
  const isInitialMount = useRef(true)

  // Check validation whenever relevant state changes
  useEffect(() => {
    const isValid =
      selectedAdvantages.length > 0 ||
      selectedChallenges.length > 0 ||
      customAdvantages.trim() ||
      customChallenges.trim() ||
      boneStructure !== "" ||
      upperBodyType !== ""
    onValidationChange(isValid)
  }, [
    selectedAdvantages.length,
    selectedChallenges.length,
    customAdvantages,
    customChallenges,
    boneStructure,
    upperBodyType,
    onValidationChange,
  ])

  // Update parent data whenever relevant state changes
  useEffect(() => {
    // Skip the initial render to avoid immediate update on mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    onUpdate({
      bodyAdvantages: selectedAdvantages,
      bodyChallenges: selectedChallenges,
      customAdvantages,
      customChallenges,
      boneStructure: boneStructure as "strong" | "delicate" | undefined,
      upperBodyType: upperBodyType as "straight" | "curved" | undefined,
    })
  }, [
    selectedAdvantages,
    selectedChallenges,
    customAdvantages,
    customChallenges,
    boneStructure,
    upperBodyType,
    onUpdate,
  ])

  const toggleAdvantage = (advantage: string) => {
    setSelectedAdvantages((prev) =>
      prev.includes(advantage) ? prev.filter((item) => item !== advantage) : [...prev, advantage],
    )
  }

  const toggleChallenge = (challenge: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challenge) ? prev.filter((item) => item !== challenge) : [...prev, challenge],
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">身体结构识别</h2>
        <p className="text-gray-600">帮助我们了解你的身体优势与挑战，补充AI无法判断的主观感知</p>
      </div>

      {/* AI Suggestions */}
      {data.aiAnalysis?.bodyAdvantages && (
        <Card className="p-4 bg-green-50 border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">🤖 AI识别的身体优势</h4>
          <div className="flex flex-wrap gap-2">
            {data.aiAnalysis.bodyAdvantages.map((advantage, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => toggleAdvantage(advantage)}
                className={`text-xs ${selectedAdvantages.includes(advantage)
                  ? "bg-green-100 border-green-300 text-green-700"
                  : "border-green-200 text-green-600"
                  }`}
              >
                {advantage}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Body Advantages */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">✨ 你的身体优势</h3>
        <p className="text-sm text-gray-600 mb-4">选择所有适用的 - 我们会在造型中突出这些优势！</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {BODY_ADVANTAGES.map((advantage) => (
            <Button
              key={advantage}
              variant="outline"
              size="sm"
              onClick={() => toggleAdvantage(advantage)}
              className={`text-sm justify-start ${selectedAdvantages.includes(advantage)
                ? "bg-pink-100 border-pink-300 text-pink-700"
                : "border-gray-200 text-gray-600"
                }`}
            >
              {advantage}
            </Button>
          ))}
        </div>

        <Input
          placeholder="其他优势..."
          value={customAdvantages}
          onChange={(e) => setCustomAdvantages(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Body Challenges */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎯 你希望弱化的部位</h3>
        <p className="text-sm text-gray-600 mb-4">我们会建议能创造美好比例的造型！</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {BODY_CHALLENGES.map((challenge) => (
            <Button
              key={challenge}
              variant="outline"
              size="sm"
              onClick={() => toggleChallenge(challenge)}
              className={`text-sm justify-start ${selectedChallenges.includes(challenge)
                ? "bg-orange-100 border-orange-300 text-orange-700"
                : "border-gray-200 text-gray-600"
                }`}
            >
              {challenge}
            </Button>
          ))}
        </div>

        <Input
          placeholder="其他希望弱化的部位..."
          value={customChallenges}
          onChange={(e) => setCustomChallenges(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Bone Structure */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🦴 判断你是：</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setBoneStructure("strong")}
            className={`w-full justify-start text-sm ${boneStructure === "strong" ? "bg-blue-100 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600"
              }`}
          >
            <span className="mr-2">💪</span>
            骨架感强（肩宽明显）
          </Button>
          <Button
            variant="outline"
            onClick={() => setBoneStructure("delicate")}
            className={`w-full justify-start text-sm ${boneStructure === "delicate"
              ? "bg-blue-100 border-blue-300 text-blue-700"
              : "border-gray-200 text-gray-600"
              }`}
          >
            <span className="mr-2">🌸</span>
            骨架感弱（肩线柔和）
          </Button>
        </div>
      </Card>

      {/* Upper Body Type */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">📐 上半身类型：</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setUpperBodyType("straight")}
            className={`w-full justify-start text-sm ${upperBodyType === "straight"
              ? "bg-purple-100 border-purple-300 text-purple-700"
              : "border-gray-200 text-gray-600"
              }`}
          >
            <span className="mr-2">📏</span>
            纸片感（胸部平坦，腰线不明显）
          </Button>
          <Button
            variant="outline"
            onClick={() => setUpperBodyType("curved")}
            className={`w-full justify-start text-sm ${upperBodyType === "curved"
              ? "bg-purple-100 border-purple-300 text-purple-700"
              : "border-gray-200 text-gray-600"
              }`}
          >
            <span className="mr-2">🌙</span>
            圆润感（胸部丰满，腰线明显）
          </Button>
        </div>
      </Card>

      {/* Encouragement */}
      <Card className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
        <div className="text-center">
          <p className="text-pink-800 font-medium">💖 记住</p>
          <p className="text-sm text-pink-700 mt-1">
            每个身体都是美丽的！我们在这里帮助你感到自信，表达你独特的风格。
          </p>
        </div>
      </Card>
    </div>
  )
}
