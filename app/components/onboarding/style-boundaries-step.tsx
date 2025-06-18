"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OnboardingData } from "@/lib/onboarding-storage";

interface StyleBoundariesStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const AVOID_ELEMENTS = [
  "Sleeveless tops",
  "Backless designs",
  "Mini skirts",
  "Turtlenecks",
  "Tight clothing",
  "High heels",
  "Large patterns",
  "Neon colors",
];

export default function StyleBoundariesStep({
  data,
  onUpdate,
  onValidationChange,
}: StyleBoundariesStepProps) {
  const [avoidElements, setAvoidElements] = useState<string[]>(data.avoidElements || []);
  const [customAvoid, setCustomAvoid] = useState(data.customAvoid || "");
  const isInitialMount = useRef(true);

  // This step is optional, so always mark as valid
  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  // Update parent data whenever relevant state changes
  useEffect(() => {
    // Skip the initial render to avoid immediate update on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    onUpdate({
      avoidElements,
      customAvoid,
    });
  }, [avoidElements, customAvoid, onUpdate]);

  const toggleAvoidElement = (element: string) => {
    setAvoidElements((prev) =>
      prev.includes(element) ? prev.filter((item) => item !== element) : [...prev, element],
    );
  };

  // Generate suggestions based on body challenges
  const getSuggestions = useCallback(() => {
    const suggestions = [];
    if (data.bodyChallenges?.includes("Wide hips")) {
      suggestions.push("Suggest avoiding tight bottoms");
    }
    if (data.bodyChallenges?.includes("Short neck")) {
      suggestions.push("Turtlenecks may not be ideal");
    }
    if (data.bodyChallenges?.includes("Broad shoulders")) {
      suggestions.push("Sleeveless tops might emphasize shoulder width");
    }
    return suggestions;
  }, [data.bodyChallenges]);

  const suggestions = getSuggestions();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Style Boundaries</h2>
        <p className="text-gray-600">
          Exclude elements you don't want to appear, let's respect your comfort zone.
        </p>
        <p className="text-sm text-pink-600 font-medium">
          This step is optional - you can skip it if you're open to anything!
        </p>
      </div>

      {/* AI-based suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <h4 className="font-semibold text-yellow-800 mb-2">
            💡 Based on your body shape analysis
          </h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index}>• {suggestion}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Avoid Elements */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🚫 Elements you wish to avoid</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select any styling elements you're not comfortable with:
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {AVOID_ELEMENTS.map((element) => (
            <Button
              key={element}
              variant="outline"
              size="sm"
              onClick={() => toggleAvoidElement(element)}
              className={`text-sm justify-start ${avoidElements.includes(element)
                ? "bg-red-100 border-red-300 text-red-700"
                : "border-gray-200 text-gray-600"
                }`}
            >
              {element}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Other elements to avoid..."
          value={customAvoid}
          onChange={(e) => setCustomAvoid(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Comfort Zone Message */}
      <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <div className="text-center">
          <p className="text-green-800 font-medium">🌱 Your Comfort Zone</p>
          <p className="text-sm text-green-700 mt-1">
            We respect your preferences! Our recommendations will work within your comfort zone
            while helping you discover new possibilities.
          </p>
        </div>
      </Card>

      {/* No Restrictions Option */}
      {avoidElements.length === 0 && !customAvoid && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <div className="text-center">
            <p className="text-purple-800 font-medium">🎉 Open to everything!</p>
            <p className="text-sm text-purple-700 mt-1">
              Great! We'll have more creative freedom to suggest diverse and exciting styles for
              you.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
