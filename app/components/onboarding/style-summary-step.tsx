"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingData } from "@/lib/onboarding-storage";
import { CheckCircle } from "lucide-react";

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
  const isGenerating = useRef(false);

  const generateInsight = useCallback(async () => {
    if (data === undefined) {
      console.log("No data");
      return;
    }


    console.log("Starting generateInsight with data:", {
      hasPhoto: !!data.fullBodyPhoto,
      skinTone: data.skinTone,
      bodyType: data.bodyType,
      stylePreferences: data.stylePreferences,
      hasObservation: !!data.aiAnalysis?.Observation
    });


    try {
      const response = await fetch("/api/generate-insight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: 7,
          goal: "Develop my personal style",
          skin_tone: data.skinTone,
          body_type: data.bodyType,
          style_preferences: data.stylePreferences,
          Observation: data.aiAnalysis?.Observation,
          gender: data.aiAnalysis?.gender
        }),
      });

      const result = await response.json();
      console.log("generateInsight result:", result);

      onUpdate({
        styleSummary: result.styleSummary.summary,
      });
    } catch (error) {
      console.error("Error in generateInsight:", error);
    } finally {
      isGenerating.current = false;
    }
  }, [onUpdate]);


  // Generate style profile based on collected data
  const generateStyleProfile = useCallback(() => {
    if (isGenerating.current) return;

    isGenerating.current = true;

    // Simulate analysis delay
    setTimeout(() => {
      const profile = {
        structureCombination: generateStructureCombination(),
        styleLabels: generateStyleLabels(),
        recommendedKeywords: generateRecommendedKeywords(),
      };

      setStyleProfile(profile);
      onUpdate({ styleProfile: profile });
      generateInsight()
      // setIsGenerating(false);
    }, 5000);
  }, [onUpdate]);

  const generateStructureCombination = () => {
    // Generate structure combination based on body analysis and preferences
    if (data.bodyAdvantages?.length) {
      return `Highlighting ${data.bodyAdvantages[0].toLowerCase()}`;
    }
    return "Balanced proportions";
  };

  const generateStyleLabels = () => {
    const labels = [];

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
    if (data.stylePreferences?.includes("minimalist")) {
      labels.push("Clean and minimal");
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
    if (data.bodyAdvantages?.includes("Broad shoulders")) {
      keywords.push("V-neck", "Statement sleeves");
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
    if (data.stylePreferences?.includes("edgy")) {
      keywords.push("Bold patterns", "Statement pieces");
    }

    return keywords.length > 0 ? keywords : ["Individual expression", "Comfortable and at ease", "Fashion-forward"];
  };

  useEffect(() => {
    //   onValidationChange(true); // This step is always valid
      generateStyleProfile();
  }, [data.selectedStyles]);

  return (
    // <div className="flex items-center justify-center min-h-[40vh]">
    <div className="space-y-6">
      <div className="text-center space-y-6">
        {(isGenerating.current) ? (
          <div className="text-center space-y-4 p-6 bg-white/50 rounded-lg">
            <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <p className="text-sm text-pink-600">AI is integrating all your information</p>
            </div>
          </div>
        ) : (data.styleSummary && data.styleSummary.length > 0) ? (<>
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-6xl animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800">Style profile generated!</h2>
          </div>
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 shadow-lg">
            <div className="flex items-center justify-start gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">AI Analysis Results</h3>
            </div>
            <div className="space-y-3 text-left">
              {data.styleSummary && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">StyleSummary:</p>
                  <p className="text-gray-800 text-sm leading-relaxed">{data.styleSummary}</p>
                </div>
              )}
            </div>
          </Card>
        </>
        ) : <div className="text-center space-y-4 p-6 bg-white/50 rounded-lg">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <p className="font-semibold text-pink-800">Loading your style profile...</p>
          </div>
        </div>}
      </div>
    </div>
  );
}
