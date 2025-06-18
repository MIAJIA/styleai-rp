"use client";

import { useState, useEffect, useCallback } from "react";
import { OnboardingData } from "@/lib/onboarding-storage";
import { Info } from "lucide-react";

interface FacialAnalysisStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

// Helper component for consistent option buttons
const OptionButton = ({ label, emoji, isSelected, onClick }: any) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 px-4 py-2 text-sm border rounded-full transition-all duration-200
        flex items-center justify-center space-x-2
        ${isSelected
          ? "bg-pink-500 border-pink-500 text-white shadow-md"
          : "bg-white border-gray-300 text-gray-700 hover:border-pink-400 hover:text-pink-600"
        }
      `}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
};

export default function FacialAnalysisStep({
  data,
  onUpdate,
  onValidationChange,
}: FacialAnalysisStepProps) {
  const [facialIntensity, setFacialIntensity] = useState(data.facialIntensity || "");
  const [facialLines, setFacialLines] = useState(data.facialLines || "");
  const [facialMaturity, setFacialMaturity] = useState(data.facialMaturity || "");

  const validateAndUpdate = useCallback(() => {
    const isValid = facialIntensity !== "" && facialLines !== "" && facialMaturity !== "";
    onValidationChange(isValid);
    onUpdate({
      facialIntensity: facialIntensity as "strong" | "light" | "medium" | undefined,
      facialLines: facialLines as "straight" | "curved" | undefined,
      facialMaturity: facialMaturity as "mature" | "youthful" | undefined,
    });
  }, [facialIntensity, facialLines, facialMaturity, onUpdate, onValidationChange]);

  useEffect(() => {
    validateAndUpdate();
  }, [validateAndUpdate]);

  const facialIntensityOptions = [
    { id: "strong", label: "Strong", emoji: "🔥" },
    { id: "medium", label: "Medium", emoji: "⚖️" },
    { id: "light", label: "Delicate", emoji: "🌸" },
  ];

  const facialLinesOptions = [
    { id: "straight", label: "Straight", emoji: "📏" },
    { id: "curved", label: "Curved", emoji: "🌙" },
  ];

  const facialMaturityOptions = [
    { id: "mature", label: "Mature", emoji: "👑" },
    { id: "youthful", label: "Youthful", emoji: "🌱" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Information Hierarchy */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Facial Structure Assessment</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please choose the description that best fits your intuition.
        </p>
      </div>

      {/* Unified Modules */}
      <div className="space-y-5">
        {/* Facial Intensity */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">🎭 Facial Feature Intensity</h3>
          <div className="flex flex-wrap gap-3">
            {facialIntensityOptions.map((opt) => (
              <OptionButton
                key={opt.id}
                {...opt}
                isSelected={facialIntensity === opt.id}
                onClick={() => setFacialIntensity(opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Facial Lines */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">📐 Facial Lines</h3>
          <div className="flex flex-wrap gap-3">
            {facialLinesOptions.map((opt) => (
              <OptionButton
                key={opt.id}
                {...opt}
                isSelected={facialLines === opt.id}
                onClick={() => setFacialLines(opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Facial Maturity */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">👶 Maturity</h3>
          <div className="flex flex-wrap gap-3">
            {facialMaturityOptions.map((opt) => (
              <OptionButton
                key={opt.id}
                {...opt}
                isSelected={facialMaturity === opt.id}
                onClick={() => setFacialMaturity(opt.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 5. Modernized Tips */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start text-gray-600">
          <Info className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs">
            Not sure how to choose? You can look in a mirror, or recall how friends usually describe
            your appearance.
          </p>
        </div>
      </div>
    </div>
  );
}
