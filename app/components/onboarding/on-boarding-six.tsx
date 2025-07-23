"use client";

import { useState, useEffect } from "react";
import { Check, Heart, Briefcase, Sparkles, Wine, Plane, Crown, Palette, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZeroStepProps {
    onValidationChange: (isValid: boolean) => void;
    data?: any;
    onUpdate?: (data: any) => void;
}

const STYLE_OPTIONS = [
  { id: "work", name: "Work", icon: Briefcase, color: "bg-slate-100 text-slate-900", description: "Professional and business attire" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900", description: "Effortlessly stylish everyday looks" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900", description: "Romantic and elegant evening wear" },
  { id: "cocktail", name: "Cocktail", icon: Wine, color: "bg-purple-100 text-purple-900", description: "Sophisticated party and event wear" },
  { id: "vacation", name: "Vacation", icon: Plane, color: "bg-sky-100 text-sky-900", description: "Comfortable and stylish travel outfits" },
  { id: "formal", name: "Formal", icon: Crown, color: "bg-amber-100 text-amber-900", description: "High-end formal and special occasions" },
  { id: "artistic", name: "Artistic", icon: Palette, color: "bg-emerald-100 text-emerald-900", description: "Creative and expressive fashion" },
  { id: "trendy", name: "Trendy", icon: Star, color: "bg-pink-100 text-pink-900", description: "Latest fashion trends and styles" },
  { id: "edgy", name: "Edgy", icon: Zap, color: "bg-gray-100 text-gray-900", description: "Bold and unconventional fashion" },
];

export default function OnBoardingSix({ onValidationChange, data, onUpdate }: ZeroStepProps) {
    const [selectedStyles, setSelectedStyles] = useState<string[]>(data?.selectedStyles || []);

    // Check validation whenever selectedStyles changes
    useEffect(() => {
        const isValid = selectedStyles.length > 0;
        onValidationChange(isValid);
    }, [selectedStyles, onValidationChange]);

    // Update parent data whenever selectedStyles changes
    useEffect(() => {
        if (onUpdate && selectedStyles.length > 0) {
            onUpdate({ selectedStyles });
        }
    }, [selectedStyles, onUpdate]);

    const toggleStyle = (styleId: string) => {
        setSelectedStyles((prev) =>
            prev.includes(styleId) 
                ? prev.filter((id) => id !== styleId) 
                : [...prev, styleId]
        );
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    Select styles you like
                </h2>
                <p className="text-gray-600 text-sm">
                    Choose multiple styles that appeal to you. You can select as many as you want!
                </p>
            </div>

            {/* Style Grid */}
            <div className="grid grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((style) => {
                    const Icon = style.icon;
                    const isSelected = selectedStyles.includes(style.id);

                    return (
                        <button
                            key={style.id}
                            onClick={() => toggleStyle(style.id)}
                            className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 aspect-square relative",
                                style.color,
                                isSelected 
                                    ? "ring-2 ring-primary ring-offset-2 scale-105 shadow-lg" 
                                    : "hover:scale-105 hover:shadow-md",
                                "border border-transparent"
                            )}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}
                            
                            <Icon size={24} className="mb-2" />
                            <span className="text-xs font-medium text-center leading-tight">
                                {style.name}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Selection Summary */}
            {selectedStyles.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                            Selected Styles ({selectedStyles.length})
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedStyles.map((styleId) => {
                            const style = STYLE_OPTIONS.find(s => s.id === styleId);
                            return (
                                <span
                                    key={styleId}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                    {style?.name}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="text-center text-sm text-gray-500">
                <p>💡 Tip: Select 3-5 styles for the best personalized experience</p>
            </div>
        </div>
    );
}