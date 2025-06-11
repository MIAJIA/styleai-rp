"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { OnboardingData } from "../../onboarding/page"

interface BodyAnalysisStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const BODY_ADVANTAGES = [
  "Long legs",
  "Slim waist",
  "Good proportions",
  "Elegant neck",
  "Defined shoulders",
  "Balanced figure",
]

const BODY_CHALLENGES = [
  "Wide hips",
  "Short legs",
  "No defined waist",
  "Short neck",
  "Broad shoulders",
  "Narrow shoulders",
]

export default function BodyAnalysisStep({ data, onUpdate, onValidationChange }: BodyAnalysisStepProps) {
  const [selectedAdvantages, setSelectedAdvantages] = useState<string[]>(data.bodyAdvantages || [])
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>(data.bodyChallenges || [])
  const [customAdvantages, setCustomAdvantages] = useState(data.customAdvantages || "")
  const [customChallenges, setCustomChallenges] = useState(data.customChallenges || "")

  // Memoize the validation check to prevent unnecessary re-renders
  const checkValidation = useCallback(() => {
    const isValid =
      selectedAdvantages.length > 0 ||
      selectedChallenges.length > 0 ||
      customAdvantages.trim() ||
      customChallenges.trim()
    onValidationChange(isValid)
  }, [selectedAdvantages.length, selectedChallenges.length, customAdvantages, customChallenges, onValidationChange])

  // Memoize the data update to prevent unnecessary re-renders
  const updateData = useCallback(() => {
    onUpdate({
      bodyAdvantages: selectedAdvantages,
      bodyChallenges: selectedChallenges,
      customAdvantages,
      customChallenges,
    })
  }, [selectedAdvantages, selectedChallenges, customAdvantages, customChallenges, onUpdate])

  // Separate useEffect for validation
  useEffect(() => {
    checkValidation()
  }, [checkValidation])

  // Separate useEffect for data updates
  useEffect(() => {
    updateData()
  }, [updateData])

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
        <h2 className="text-2xl font-bold text-gray-800">Know Your Body</h2>
        <p className="text-gray-600">
          Help us understand what you love about your body and what you'd like to enhance or balance.
        </p>
      </div>

      {/* AI Suggestions */}
      {data.aiAnalysis?.bodyAdvantages && (
        <Card className="p-4 bg-green-50 border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">🤖 AI Detected Advantages</h4>
          <div className="flex flex-wrap gap-2">
            {data.aiAnalysis.bodyAdvantages.map((advantage, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => toggleAdvantage(advantage)}
                className={`text-xs ${
                  selectedAdvantages.includes(advantage)
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
        <h3 className="font-semibold text-gray-800 mb-3">✨ What are your body's best features?</h3>
        <p className="text-sm text-gray-600 mb-4">Select all that apply - we'll highlight these in your styling!</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {BODY_ADVANTAGES.map((advantage) => (
            <Button
              key={advantage}
              variant="outline"
              size="sm"
              onClick={() => toggleAdvantage(advantage)}
              className={`text-sm justify-start ${
                selectedAdvantages.includes(advantage)
                  ? "bg-pink-100 border-pink-300 text-pink-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {advantage}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Other advantages..."
          value={customAdvantages}
          onChange={(e) => setCustomAdvantages(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Body Challenges */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎯 Areas you'd like to balance or enhance?</h3>
        <p className="text-sm text-gray-600 mb-4">We'll suggest styles that create beautiful proportions!</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {BODY_CHALLENGES.map((challenge) => (
            <Button
              key={challenge}
              variant="outline"
              size="sm"
              onClick={() => toggleChallenge(challenge)}
              className={`text-sm justify-start ${
                selectedChallenges.includes(challenge)
                  ? "bg-orange-100 border-orange-300 text-orange-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {challenge}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Other areas to enhance..."
          value={customChallenges}
          onChange={(e) => setCustomChallenges(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Encouragement */}
      <Card className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
        <div className="text-center">
          <p className="text-pink-800 font-medium">💖 Remember</p>
          <p className="text-sm text-pink-700 mt-1">
            Every body is beautiful! We're here to help you feel confident and express your unique style.
          </p>
        </div>
      </Card>
    </div>
  )
}
