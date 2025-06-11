"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { OnboardingData } from "@/lib/onboarding-storage"

interface ScenarioStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const SCENARIOS = [
  { id: "work", label: "工作职场", emoji: "💼", description: "办公室会议、演讲、商务社交" },
  { id: "date", label: "约会社交", emoji: "💕", description: "晚餐约会、聚会、社交活动" },
  { id: "casual", label: "日常休闲", emoji: "☀️", description: "日常出行、咖啡约会、周末外出" },
  { id: "special", label: "特殊活动", emoji: "✨", description: "婚礼、晚宴、重要场合" },
  { id: "travel", label: "旅行度假", emoji: "🌴", description: "旅游、观光、度假活动" },
  { id: "creative", label: "创意表达", emoji: "🎨", description: "艺术活动、创意工作、自我表达" },
]

export default function ScenarioStep({ data, onUpdate, onValidationChange }: ScenarioStepProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>(data.primaryScenario || "")
  const [customScenario, setCustomScenario] = useState(data.customScenario || "")
  const isInitialMount = useRef(true)

  // Check validation whenever relevant state changes
  useEffect(() => {
    const isValid = selectedScenario !== "" || customScenario.trim() !== ""
    onValidationChange(isValid)
  }, [selectedScenario, customScenario, onValidationChange])

  // Update parent data whenever relevant state changes
  useEffect(() => {
    // Skip the initial render to avoid immediate update on mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    onUpdate({
      primaryScenario: selectedScenario,
      customScenario,
    })
  }, [selectedScenario, customScenario, onUpdate])

  const selectScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">使用场景</h2>
        <p className="text-gray-600">明确搭配需求背景，提升风格实用性</p>
      </div>

      {/* Scenario Options */}
      <div className="space-y-3">
        {SCENARIOS.map((scenario) => (
          <Card
            key={scenario.id}
            className={`p-4 cursor-pointer transition-all ${selectedScenario === scenario.id
              ? "bg-gradient-to-r from-pink-50 to-rose-50 border-pink-300 shadow-md"
              : "border-gray-200 hover:border-pink-200"
              }`}
            onClick={() => selectScenario(scenario.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{scenario.emoji}</div>
              <div className="flex-1">
                <h3 className={`font-semibold ${selectedScenario === scenario.id ? "text-pink-800" : "text-gray-800"}`}>
                  {scenario.label}
                </h3>
                <p className={`text-sm ${selectedScenario === scenario.id ? "text-pink-600" : "text-gray-600"}`}>
                  {scenario.description}
                </p>
              </div>
              {selectedScenario === scenario.id && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Custom Scenario Input */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎯 或描述你的具体需求</h3>
        <Input
          placeholder="例如：求职面试、妈妈日常、学生活动..."
          value={customScenario}
          onChange={(e) => setCustomScenario(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Styling Context */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="text-center">
          <p className="text-blue-800 font-medium">🎪 场景很重要</p>
          <p className="text-sm text-blue-700 mt-1">了解你的主要场景有助于我们建议合适的风格、颜色和正式程度。</p>
        </div>
      </Card>
    </div>
  )
}
