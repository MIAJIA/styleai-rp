"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";
import { OnboardingData } from "@/lib/onboarding-storage";

interface BodyAnalysisStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const BODY_ADVANTAGES = [
  "Long legs",
  "Slim waist",
  "Good proportions",
  "Good shoulder & neck line",
  "Defined shoulders",
  "Well-proportioned body",
];

const BODY_CHALLENGES = [
  "Wide hips",
  "Short legs",
  "No defined waistline",
  "Short neck",
  "Broad shoulders",
  "Narrow shoulders",
];

export default function BodyAnalysisStep({
  data,
  onUpdate,
  onValidationChange,
}: BodyAnalysisStepProps) {
  const [selectedAdvantages, setSelectedAdvantages] = useState<string[]>(data.bodyAdvantages || []);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>(data.bodyChallenges || []);
  const [customAdvantages, setCustomAdvantages] = useState(data.customAdvantages || "");
  const [customChallenges, setCustomChallenges] = useState(data.customChallenges || "");
  const [showDetails, setShowDetails] = useState(false);
  const isInitialMount = useRef(true);

  // Load AI suggestions into selected advantages on mount
  useEffect(() => {
    if (data.aiAnalysis?.bodyAdvantages && selectedAdvantages.length === 0) {
      setSelectedAdvantages(data.aiAnalysis.bodyAdvantages);
    }
  }, [data.aiAnalysis?.bodyAdvantages]);

  // Check validation whenever relevant state changes
  useEffect(() => {
    const isValid = Boolean(
      selectedAdvantages.length > 0 ||
      selectedChallenges.length > 0 ||
      customAdvantages.trim() ||
      customChallenges.trim()
    );
    onValidationChange(isValid);
  }, [
    selectedAdvantages.length,
    selectedChallenges.length,
    customAdvantages,
    customChallenges,
    onValidationChange,
  ]);

  // Update parent data whenever relevant state changes
  useEffect(() => {
    // Skip the initial render to avoid immediate update on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    onUpdate({
      bodyAdvantages: selectedAdvantages,
      bodyChallenges: selectedChallenges,
      customAdvantages,
      customChallenges,
    });
  }, [
    selectedAdvantages,
    selectedChallenges,
    customAdvantages,
    customChallenges,
    onUpdate,
  ]);

  const toggleAdvantage = (advantage: string) => {
    setSelectedAdvantages((prev) =>
      prev.includes(advantage) ? prev.filter((item) => item !== advantage) : [...prev, advantage],
    );
  };

  const toggleChallenge = (challenge: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challenge) ? prev.filter((item) => item !== challenge) : [...prev, challenge],
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Body Structure Recognition</h2>
        <p className="text-sm text-pink-600 font-medium">
          💖 Every body is beautiful! We help you discover your unique charm
        </p>

        {/* Expandable Details */}
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-500 hover:text-gray-700 p-1 h-auto"
          >
            <span className="flex items-center space-x-1">
              <span>Learn more</span>
              {showDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </span>
          </Button>

          {showDetails && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs text-gray-600">
                Help us understand your body's strengths and challenges, supplementing what AI
                can't perceive subjectively.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body Advantages */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">✨ Your Body's Strengths</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select all that apply - we'll highlight these strengths in your styling!
        </p>

        {data.aiAnalysis?.bodyAdvantages && data.aiAnalysis.bodyAdvantages.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700 flex items-center">
              <span className="mr-1">🤖</span>
              AI has pre-selected some strengths for you, feel free to adjust.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {BODY_ADVANTAGES.map((advantage) => (
            <Button
              key={advantage}
              variant="outline"
              size="sm"
              onClick={() => toggleAdvantage(advantage)}
              className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${selectedAdvantages.includes(advantage)
                ? "bg-pink-100 border-pink-300 text-pink-700"
                : "border-gray-200 text-gray-600"
                }`}
            >
              {advantage}
            </Button>
          ))}

          {/* Add AI-identified advantages that are not in the predefined list */}
          {data.aiAnalysis?.bodyAdvantages
            ?.filter((advantage) => !BODY_ADVANTAGES.includes(advantage))
            .map((advantage, index) => (
              <Button
                key={`ai-${index}`}
                variant="outline"
                size="sm"
                onClick={() => toggleAdvantage(advantage)}
                className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${selectedAdvantages.includes(advantage)
                  ? "bg-green-100 border-green-300 text-green-700"
                  : "border-green-200 text-green-600"
                  }`}
              >
                <span className="mr-1 text-xs">🤖</span>
                {advantage}
              </Button>
            ))}
        </div>

        <Input
          placeholder="Other strengths..."
          value={customAdvantages}
          onChange={(e) => setCustomAdvantages(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Body Challenges */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎯 Areas You'd Like to Downplay</h3>
        <p className="text-sm text-gray-600 mb-4">
          We'll suggest styles that create beautiful proportions!
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {BODY_CHALLENGES.map((challenge) => (
            <Button
              key={challenge}
              variant="outline"
              size="sm"
              onClick={() => toggleChallenge(challenge)}
              className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${selectedChallenges.includes(challenge)
                ? "bg-orange-100 border-orange-300 text-orange-700"
                : "border-gray-200 text-gray-600"
                }`}
            >
              {challenge}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Other areas to downplay..."
          value={customChallenges}
          onChange={(e) => setCustomChallenges(e.target.value)}
          className="text-sm"
        />
      </Card>
    </div>
  );
}
