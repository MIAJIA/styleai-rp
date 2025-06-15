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
  { id: "fresh", label: "清新青春", emoji: "🌸", description: "甜美、活力、少女感" },
  { id: "elegant", label: "优雅精致", emoji: "👑", description: "精致、温柔、知性美" },
  { id: "cool", label: "酷感锐利", emoji: "🖤", description: "自信、时尚、个性强" },
  { id: "sweet", label: "甜辣并存", emoji: "🔥", description: "吸睛、妩媚、有魅力" },
  { id: "professional", label: "专业干练", emoji: "💼", description: "利落、有气场、职场感" },
  { id: "minimalist", label: "极简艺术", emoji: "🎨", description: "克制、深思、高级感" },
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
        <h2 className="text-2xl font-bold text-gray-800">风格偏好选择</h2>
        <p className="text-gray-600">确定你"想要成为谁"的穿搭方向，可以选择多个风格！</p>
      </div>

      {/* Style Options */}
      <div className="space-y-3">
        {STYLE_OPTIONS.map((style) => (
          <Card
            key={style.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedStyles.includes(style.id)
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
        <h3 className="font-semibold text-gray-800 mb-3">✨ 描述你的独特风格</h3>
        <Input
          placeholder="例如：波西米亚风、复古港风、运动优雅..."
          value={customStyle}
          onChange={(e) => setCustomStyle(e.target.value)}
          className="text-sm"
        />
      </Card>
    </div>
  );
}
