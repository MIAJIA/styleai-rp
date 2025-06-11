"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { OnboardingData } from "../../onboarding/page"

interface ScenarioStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const SCENARIOS = [
  { id: "work", label: "Work & Professional", emoji: "💼", description: "Office meetings, presentations, networking" },
  { id: "date", label: "Dates & Social Events", emoji: "💕", description: "Dinner dates, parties, social gatherings" },
  { id: "casual", label: "Everyday & Casual", emoji: "☀️", description: "Daily errands, coffee dates, weekend outings" },
  { id: "special", label: "Special Occasions", emoji: "✨", description: "Weddings, galas, important events" },
  { id: "travel", label: "Travel & Vacation", emoji: "🌴", description: "Trips, sightseeing, vacation activities" },
  {
    id: "creative",
    label: "Creative & Artistic",
    emoji: "🎨",
    description: "Art events, creative work, self-expression",
  },
]

export default function ScenarioStep({ data, onUpdate, onValidationChange }: ScenarioStepProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>(data.primaryScenario || "")
  const [customScenario, setCustomScenario] = useState(data.customScenario || "")

  // Memoize validation and update functions
  const validateAndUpdate = useCallback(() => {
    const isValid = selectedScenario !== "" || customScenario.trim() !== ""
    onValidationChange(isValid)

    onUpdate({
      primaryScenario: selectedScenario,
      customScenario,
    })
  }, [selectedScenario, customScenario, onUpdate, onValidationChange])

  useEffect(() => {
    validateAndUpdate()
  }, [validateAndUpdate])

  const selectScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Where Will You Shine?</h2>
        <p className="text-gray-600">
          Tell us your main styling focus so we can create the perfect looks for your lifestyle.
        </p>
      </div>

      {/* Scenario Options */}
      <div className="space-y-3">
        {SCENARIOS.map((scenario) => (
          <Card
            key={scenario.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedScenario === scenario.id
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
        <h3 className="font-semibold text-gray-800 mb-3">🎯 Or describe your specific needs</h3>
        <Input
          placeholder="e.g., Job interviews, Mom life, Student events..."
          value={customScenario}
          onChange={(e) => setCustomScenario(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Styling Context */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="text-center">
          <p className="text-blue-800 font-medium">🎪 Context Matters</p>
          <p className="text-sm text-blue-700 mt-1">
            Knowing your main scenarios helps us suggest appropriate styles, colors, and formality levels.
          </p>
        </div>
      </Card>
    </div>
  )
}
