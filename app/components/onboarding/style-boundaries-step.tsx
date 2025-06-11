"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { OnboardingData } from "../../onboarding/page"

interface StyleBoundariesStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const AVOID_ELEMENTS = ["无袖上衣", "露背设计", "迷你裙", "高领衣服", "紧身衣物", "高跟鞋", "大图案", "荧光色"]

export default function StyleBoundariesStep({ data, onUpdate, onValidationChange }: StyleBoundariesStepProps) {
  const [avoidElements, setAvoidElements] = useState<string[]>(data.avoidElements || [])
  const [customAvoid, setCustomAvoid] = useState(data.customAvoid || "")

  // Memoize the update function
  const updateData = useCallback(() => {
    // This step is optional, so always valid
    onValidationChange(true)

    onUpdate({
      avoidElements,
      customAvoid,
    })
  }, [avoidElements, customAvoid, onUpdate, onValidationChange])

  useEffect(() => {
    updateData()
  }, [updateData])

  const toggleAvoidElement = (element: string) => {
    setAvoidElements((prev) => (prev.includes(element) ? prev.filter((item) => item !== element) : [...prev, element]))
  }

  // Generate suggestions based on body challenges
  const getSuggestions = useCallback(() => {
    const suggestions = []
    if (data.bodyChallenges?.includes("胯宽")) {
      suggestions.push("建议避开紧身下装")
    }
    if (data.bodyChallenges?.includes("脖子短")) {
      suggestions.push("高领可能不太理想")
    }
    if (data.bodyChallenges?.includes("肩膀宽")) {
      suggestions.push("无袖上衣可能会强调肩宽")
    }
    return suggestions
  }, [data.bodyChallenges])

  const suggestions = getSuggestions()

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">风格边界</h2>
        <p className="text-gray-600">排除你不希望出现的搭配元素，让我们尊重你的舒适区。</p>
        <p className="text-sm text-pink-600 font-medium">这一步是可选的 - 如果你对一切都开放可以跳过！</p>
      </div>

      {/* AI-based suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <h4 className="font-semibold text-yellow-800 mb-2">💡 基于你的身形分析</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index}>• {suggestion}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Avoid Elements */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🚫 你希望避免的元素</h3>
        <p className="text-sm text-gray-600 mb-4">选择任何你不太舒服的造型元素：</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {AVOID_ELEMENTS.map((element) => (
            <Button
              key={element}
              variant="outline"
              size="sm"
              onClick={() => toggleAvoidElement(element)}
              className={`text-sm justify-start ${
                avoidElements.includes(element)
                  ? "bg-red-100 border-red-300 text-red-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {element}
            </Button>
          ))}
        </div>

        <Input
          placeholder="其他要避免的元素..."
          value={customAvoid}
          onChange={(e) => setCustomAvoid(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Comfort Zone Message */}
      <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <div className="text-center">
          <p className="text-green-800 font-medium">🌱 你的舒适区</p>
          <p className="text-sm text-green-700 mt-1">
            我们尊重你的偏好！我们的建议会在你的舒适区内工作，同时帮助你发现新的可能性。
          </p>
        </div>
      </Card>

      {/* No Restrictions Option */}
      {avoidElements.length === 0 && !customAvoid && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <div className="text-center">
            <p className="text-purple-800 font-medium">🎉 对一切都开放！</p>
            <p className="text-sm text-purple-700 mt-1">
              太好了！我们将有更多创意自由来为你建议多样化和令人兴奋的风格。
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
