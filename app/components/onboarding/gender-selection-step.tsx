"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, Users, Heart } from "lucide-react";
import { OnboardingData } from "@/lib/onboarding-storage";

interface GenderSelectionStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function GenderSelectionStep({
  data,
  onUpdate,
  onValidationChange,
}: GenderSelectionStepProps) {
  const [selectedGender, setSelectedGender] = useState<string>("");

  // Load saved gender on mount
  useEffect(() => {
    if (data.gender) {
      setSelectedGender(data.gender);
    }
  }, [data.gender]);

  // Validate and update parent
  useEffect(() => {
    const isValid = Boolean(selectedGender);
    onValidationChange(isValid);

    if (selectedGender) {
      onUpdate({
        gender: selectedGender as 'male' | 'female' | 'non-binary' | 'prefer-not-to-say',
      });
    }
  }, [selectedGender, onUpdate, onValidationChange]);

  const genderOptions = [
    {
      id: 'female',
      label: 'Female',
      icon: User,
      description: 'I identify as female',
      color: 'from-pink-400 to-rose-400'
    },
    {
      id: 'male',
      label: 'Male',
      icon: User,
      description: 'I identify as male',
      color: 'from-blue-400 to-indigo-400'
    },
    {
      id: 'non-binary',
      label: 'Non-binary',
      icon: Users,
      description: 'I identify as non-binary',
      color: 'from-purple-400 to-violet-400'
    },
    {
      id: 'prefer-not-to-say',
      label: 'Prefer not to say',
      icon: Heart,
      description: 'I prefer not to specify',
      color: 'from-gray-400 to-slate-400'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center mx-auto">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Tell us about yourself</h2>
        <p className="text-gray-600 text-sm leading-relaxed">
          This helps us provide more personalized styling suggestions that match your preferences and identity.
        </p>
      </div>

      {/* Gender Options */}
      <div className="space-y-3">
        {genderOptions.map((option) => {
          const IconComponent = option.icon;
          const isSelected = selectedGender === option.id;

          return (
            <Card
              key={option.id}
              className={`p-4 cursor-pointer transition-all duration-200 border-2 ${isSelected
                  ? 'border-pink-400 bg-pink-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              onClick={() => setSelectedGender(option.id)}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${option.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{option.label}</h3>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Privacy Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Heart className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 text-sm">Privacy & Inclusivity</h4>
            <p className="text-blue-700 text-xs mt-1 leading-relaxed">
              This information is used solely to provide you with more relevant styling suggestions.
              We respect all gender identities and create inclusive fashion recommendations for everyone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}