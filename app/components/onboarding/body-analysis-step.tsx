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

const BODY_ADVANTAGES = ["腿长", "腰细", "比例好", "肩颈线条好", "肩膀有型", "身材匀称"];

const BODY_CHALLENGES = ["胯宽", "腿短", "无腰线", "脖子短", "肩膀宽", "肩膀窄"];

export default function BodyAnalysisStep({
  data,
  onUpdate,
  onValidationChange,
}: BodyAnalysisStepProps) {
  const [selectedAdvantages, setSelectedAdvantages] = useState<string[]>(data.bodyAdvantages || []);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>(data.bodyChallenges || []);
  const [customAdvantages, setCustomAdvantages] = useState(data.customAdvantages || "");
  const [customChallenges, setCustomChallenges] = useState(data.customChallenges || "");
  const [boneStructure, setBoneStructure] = useState<"strong" | "delicate" | "">(
    data.boneStructure || "",
  );
  const [upperBodyType, setUpperBodyType] = useState<"straight" | "curved" | "">(
    data.upperBodyType || "",
  );
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
    const isValid =
      selectedAdvantages.length > 0 ||
      selectedChallenges.length > 0 ||
      customAdvantages.trim() ||
      customChallenges.trim() ||
      boneStructure !== "" ||
      upperBodyType !== "";
    onValidationChange(isValid);
  }, [
    selectedAdvantages.length,
    selectedChallenges.length,
    customAdvantages,
    customChallenges,
    boneStructure,
    upperBodyType,
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
      boneStructure: boneStructure as "strong" | "delicate" | undefined,
      upperBodyType: upperBodyType as "straight" | "curved" | undefined,
    });
  }, [
    selectedAdvantages,
    selectedChallenges,
    customAdvantages,
    customChallenges,
    boneStructure,
    upperBodyType,
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
        <h2 className="text-2xl font-bold text-gray-800">身体结构识别</h2>
        <p className="text-sm text-pink-600 font-medium">
          💖 每个身体都是美丽的！我们帮助你发现独特魅力
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
              <span>了解更多</span>
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
                帮助我们了解你的身体优势与挑战，补充AI无法判断的主观感知
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body Advantages */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">✨ 你的身体优势</h3>
        <p className="text-sm text-gray-600 mb-4">选择所有适用的 - 我们会在造型中突出这些优势！</p>

        {data.aiAnalysis?.bodyAdvantages && data.aiAnalysis.bodyAdvantages.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700 flex items-center">
              <span className="mr-1">🤖</span>
              AI已为你预选了一些优势，你可以自由调整
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
              className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${
                selectedAdvantages.includes(advantage)
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
                className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${
                  selectedAdvantages.includes(advantage)
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
          placeholder="其他优势..."
          value={customAdvantages}
          onChange={(e) => setCustomAdvantages(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Body Challenges */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🎯 你希望弱化的部位</h3>
        <p className="text-sm text-gray-600 mb-4">我们会建议能创造美好比例的造型！</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {BODY_CHALLENGES.map((challenge) => (
            <Button
              key={challenge}
              variant="outline"
              size="sm"
              onClick={() => toggleChallenge(challenge)}
              className={`text-sm px-3 py-1 h-auto whitespace-nowrap ${
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
          placeholder="其他希望弱化的部位..."
          value={customChallenges}
          onChange={(e) => setCustomChallenges(e.target.value)}
          className="text-sm"
        />
      </Card>

      {/* Bone Structure */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">🦴 骨架类型：</h3>
        <p className="text-sm text-gray-600 mb-4">整体骨骼框架的感觉</p>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setBoneStructure("strong")}
            className={`w-full justify-start text-sm p-3 h-auto ${
              boneStructure === "strong"
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <span className="mr-2">💪</span>
            大骨架（肩宽、手腕粗、整体框架大）
          </Button>
          <Button
            variant="outline"
            onClick={() => setBoneStructure("delicate")}
            className={`w-full justify-start text-sm p-3 h-auto ${
              boneStructure === "delicate"
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <span className="mr-2">🌸</span>
            小骨架（肩窄、手腕细、整体框架小）
          </Button>
        </div>
      </Card>

      {/* Upper Body Type */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">📐 身材曲线：</h3>
        <p className="text-sm text-gray-600 mb-4">身体的立体感和曲线分布</p>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setUpperBodyType("straight")}
            className={`w-full justify-start text-sm p-3 h-auto ${
              upperBodyType === "straight"
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <span className="mr-2">📏</span>
            直线型（身体平坦，缺乏起伏曲线）
          </Button>
          <Button
            variant="outline"
            onClick={() => setUpperBodyType("curved")}
            className={`w-full justify-start text-sm p-3 h-auto ${
              upperBodyType === "curved"
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <span className="mr-2">🌙</span>
            曲线型（身体有明显的凹凸起伏）
          </Button>
        </div>
      </Card>
    </div>
  );
}
