"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingData } from "@/lib/onboarding-storage";

interface StyleSummaryStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function StyleSummaryStep({
  data,
  onUpdate,
  onValidationChange,
}: StyleSummaryStepProps) {
  const [styleProfile, setStyleProfile] = useState(data.styleProfile || null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate style profile based on collected data
  const generateStyleProfile = useCallback(() => {
    if (styleProfile || isGenerating) return;

    setIsGenerating(true);

    // Simulate analysis delay
    setTimeout(() => {
      const profile = {
        structureCombination: generateStructureCombination(),
        styleLabels: generateStyleLabels(),
        recommendedKeywords: generateRecommendedKeywords(),
      };

      setStyleProfile(profile);
      onUpdate({ styleProfile: profile });
      setIsGenerating(false);
    }, 2000);
  }, [styleProfile, isGenerating, onUpdate]);

  const generateStructureCombination = () => {
    const face =
      data.facialIntensity === "strong"
        ? "Strong features"
        : data.facialIntensity === "light"
          ? "Delicate features"
          : "Balanced features";

    return `${face}`;
  };

  const generateStyleLabels = () => {
    const labels = [];

    // Based on facial analysis
    if (data.facialIntensity === "strong" && data.facialMaturity === "youthful") {
      labels.push("Sweet & cool girly face");
    } else if (data.facialIntensity === "light" && data.facialLines === "curved") {
      labels.push("Gentle delicate face");
    } else if (data.facialMaturity === "mature" && data.facialLines === "straight") {
      labels.push("Elegant and cool");
    }

    // Based on style preferences
    if (data.stylePreferences?.includes("elegant")) {
      labels.push("Elegant and intellectual");
    }
    if (data.stylePreferences?.includes("cool")) {
      labels.push("Cool and fashionable");
    }
    if (data.stylePreferences?.includes("fresh")) {
      labels.push("Fresh and vibrant");
    }

    // Based on scenario
    if (data.primaryScenario === "work") {
      labels.push("Business elite");
    } else if (data.primaryScenario === "casual") {
      labels.push("Daily comfort");
    }

    return labels.length > 0 ? labels : ["Unique personality", "Diverse style"];
  };

  const generateRecommendedKeywords = () => {
    const keywords = [];

    // Based on body advantages
    if (data.bodyAdvantages?.includes("Slim waist")) {
      keywords.push("High waistline");
    }
    if (data.bodyAdvantages?.includes("Long legs")) {
      keywords.push("Crop top");
    }

    // Based on style preferences
    if (data.stylePreferences?.includes("minimalist")) {
      keywords.push("Simple lines", "Neutral tones");
    }
    if (data.stylePreferences?.includes("elegant")) {
      keywords.push("Exquisite details", "Elegant tailoring");
    }
    if (data.stylePreferences?.includes("fresh")) {
      keywords.push("Bright colors", "Lightweight fabrics");
    }

    // Based on facial analysis
    if (data.facialIntensity === "strong") {
      keywords.push("Simple design");
    } else if (data.facialIntensity === "light") {
      keywords.push("Delicate decoration");
    }

    return keywords.length > 0 ? keywords : ["Individual expression", "Comfortable and at ease", "Fashion-forward"];
  };

  useEffect(() => {
    onValidationChange(true); // This step is always valid
    generateStyleProfile();
  }, [onValidationChange, generateStyleProfile]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      {isGenerating ? (
        <div className="text-center space-y-4 p-6 bg-white/50 rounded-lg">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <p className="font-semibold text-pink-800">Generating your style profile...</p>
            <p className="text-sm text-pink-600">AI is integrating all your information</p>
          </div>
        </div>
      ) : styleProfile ? (
        <div className="text-center space-y-4 p-6">
          <div className="text-6xl animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800">Style profile generated!</h2>
        </div>
      ) : null}
    </div>
  );
}
