"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { OnboardingData } from "../../onboarding/page"

interface PersonalizationStepProps {
  data: OnboardingData
  onUpdate: (data: Partial<OnboardingData>) => void
  onValidationChange: (isValid: boolean) => void
}

const SPECIFIC_STYLES = [
  { id: "korean", label: "Korean Style", emoji: "🇰🇷", description: "K-fashion trends, cute and trendy" },
  { id: "french", label: "French Chic", emoji: "🇫🇷", description: "Effortless elegance, timeless pieces" },
  { id: "japanese", label: "Japanese Minimalism", emoji: "🇯🇵", description: "Clean lines, quality basics" },
  { id: "dark", label: "Dark Academia", emoji: "🖤", description: "Scholarly, vintage-inspired, moody" },
  { id: "boho", label: "Bohemian", emoji: "🌻", description: "Free-spirited, artistic, flowing" },
  { id: "scandi", label: "Scandinavian", emoji: "❄️", description: "Minimalist, cozy, functional" },
]

export default function PersonalizationStep({ data, onUpdate, onValidationChange }: PersonalizationStepProps) {
  const [sustainableFashion, setSustainableFashion] = useState(data.sustainableFashion || false)
  const [accessoryMatching, setAccessoryMatching] = useState(data.accessoryMatching || false)
  const [specificStyles, setSpecificStyles] = useState<string[]>(data.specificStyles || [])
  const [customSpecificStyle, setCustomSpecificStyle] = useState(data.customSpecificStyle || "")

  // Memoize the update function
  const updateData = useCallback(() => {
    // This step is completely optional
    onValidationChange(true)

    onUpdate({
      sustainableFashion,
      accessoryMatching,
      specificStyles,
      customSpecificStyle,
    })
  }, [sustainableFashion, accessoryMatching, specificStyles, customSpecificStyle, onUpdate, onValidationChange])

  useEffect(() => {
    updateData()
  }, [updateData])

  const toggleSpecificStyle = (styleId: string) => {
    setSpecificStyles((prev) => (prev.includes(styleId) ? prev.filter((item) => item !== styleId) : [...prev, styleId]))
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Final Touches</h2>
        <p className="text-gray-600">These preferences will help us fine-tune your styling experience.</p>
        <p className="text-sm text-pink-600 font-medium">
          All optional - customize as much or as little as you'd like!
        </p>
      </div>

      {/* Sustainability Preference */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 flex items-center">🌱 Sustainable Fashion Focus</h3>
            <p className="text-sm text-gray-600 mt-1">Prioritize eco-friendly brands and sustainable styling tips</p>
          </div>
          <Switch checked={sustainableFashion} onCheckedChange={setSustainableFashion} />
        </div>
      </Card>

      {/* Accessory Matching */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 flex items-center">💎 Complete Look Styling</h3>
            <p className="text-sm text-gray-600 mt-1">Include accessories, bags, and jewelry recommendations</p>
          </div>
          <Switch checked={accessoryMatching} onCheckedChange={setAccessoryMatching} />
        </div>
      </Card>

      {/* Specific Style Preferences */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎨 Specific Style Inspirations</h3>
        <p className="text-sm text-gray-600 mb-4">Any particular cultural or aesthetic styles you love?</p>

        <div className="space-y-2 mb-4">
          {SPECIFIC_STYLES.map((style) => (
            <div
              key={style.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                specificStyles.includes(style.id)
                  ? "bg-pink-50 border-pink-300"
                  : "border-gray-200 hover:border-pink-200"
              }`}
              onClick={() => toggleSpecificStyle(style.id)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{style.emoji}</span>
                <div className="flex-1">
                  <h4
                    className={`font-medium ${specificStyles.includes(style.id) ? "text-pink-800" : "text-gray-800"}`}
                  >
                    {style.label}
                  </h4>
                  <p className={`text-xs ${specificStyles.includes(style.id) ? "text-pink-600" : "text-gray-600"}`}>
                    {style.description}
                  </p>
                </div>
                {specificStyles.includes(style.id) && (
                  <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Input
          placeholder="Other style inspirations..."
          value={customSpecificStyle}
          onChange={(e) => setCustomSpecificStyle(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Completion Message */}
      <Card className="p-6 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 border-pink-200">
        <div className="text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold text-gray-800">Almost Ready!</h3>
          <p className="text-gray-600">
            You're all set to discover your perfect style. Our AI stylist now knows exactly how to help you look and
            feel amazing!
          </p>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 mt-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Photos analyzed</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Preferences set</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Ready to style</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
