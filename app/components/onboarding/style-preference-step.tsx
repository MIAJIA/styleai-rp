"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/lib/onboarding-storage";

interface StylePreferenceStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const STYLE_OPTIONS = [
  {
    id: "fresh",
    label: "Fresh & Youthful",
    emoji: "🌸",
    description: "Sweet, vibrant, girly",
  },
  {
    id: "elegant",
    label: "Elegant & Refined",
    emoji: "👑",
    description: "Exquisite, gentle, intellectual beauty",
  },
  { id: "cool", label: "Cool & Sharp", emoji: "🖤", description: "Confident, fashionable, strong personality" },
  {
    id: "sweet",
    label: "Sweet & Spicy",
    emoji: "🔥",
    description: "Eye-catching, charming, attractive",
  },
  {
    id: "professional",
    label: "Professional & Capable",
    emoji: "💼",
    description: "Neat, charismatic, business-like",
  },
  {
    id: "minimalist",
    label: "Minimalist & Artistic",
    emoji: "🎨",
    description: "Restrained, thoughtful, high-class feel",
  },
];

export default function StylePreferenceStep({
  data,
  onUpdate,
  onValidationChange,
}: StylePreferenceStepProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>(data.stylePreferences || []);
  const [customStyle, setCustomStyle] = useState(data.customStyle || "");
  const isInitialMount = useRef(true);

  // Check validation whenever relevant state changes
  useEffect(() => {
    const isValid = selectedStyles.length > 0 || customStyle.trim() !== "";
    onValidationChange(isValid);
  }, [selectedStyles.length, customStyle, onValidationChange]);

  // Update parent data whenever relevant state changes
  useEffect(() => {
    // Skip the initial render to avoid immediate update on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    onUpdate({
      stylePreferences: selectedStyles,
      customStyle,
    });
  }, [selectedStyles, customStyle, onUpdate]);

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId) ? prev.filter((item) => item !== styleId) : [...prev, styleId],
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Style Preference Selection</h2>
        <p className="text-gray-600">
          Determine the direction of who you "want to be" with your outfits, you can choose
          multiple styles!
        </p>
      </div>

      {/* Style Options */}
      <div className="space-y-3">
        {STYLE_OPTIONS.map((style) => (
          <Card
            key={style.id}
            className={`p-4 cursor-pointer transition-all ${selectedStyles.includes(style.id)
              ? "bg-gradient-to-r from-pink-50 to-rose-50 border-pink-300 shadow-md"
              : "border-gray-200 hover:border-pink-200"
              }`}
            onClick={() => toggleStyle(style.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{style.emoji}</div>
              <div className="flex-1">
                <h3
                  className={`font-semibold ${selectedStyles.includes(style.id) ? "text-pink-800" : "text-gray-800"}`}
                >
                  {style.label}
                </h3>
                <p
                  className={`text-sm ${selectedStyles.includes(style.id) ? "text-pink-600" : "text-gray-600"}`}
                >
                  {style.description}
                </p>
              </div>
              {selectedStyles.includes(style.id) && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Custom Style Input */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">✨ Describe your unique style</h3>
        <Input
          placeholder="e.g., Bohemian, retro Hong Kong style, sporty elegance..."
          value={customStyle}
          onChange={(e) => setCustomStyle(e.target.value)}
          className="text-sm"
        />
      </Card>
    </div>
  );
}
