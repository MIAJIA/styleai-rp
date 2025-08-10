"use client";

import { useState, useEffect } from "react";
import { Check, Heart, Briefcase, Sparkles, Plane, Palette, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepProps } from "./on-boarding-step";


const STYLE_OPTIONS = [
    { id: "Casual", name: "Casual", icon: "/onboarding/Style/Casual.png", },
    { id: "Classy", name: "Classy", icon: "/onboarding/Style/Classy.jpg", },
    { id: "Old Money", name: "Old Money", icon: "/onboarding/Style/OldMoney.png", },
    { id: "Preppy", name: "Preppy", icon: "/onboarding/Style/Preppy.png", },
    { id: "Coastal", name: "Coastal", icon: "/onboarding/Style/Coastal.png", },
    { id: "Boho", name: "Boho", icon: "/onboarding/Style/Boho.png", },
    { id: "Coquette", name: "Coquette", icon: "/onboarding/Style/Coquette.png", },
    { id: "Edgy", name: "Edgy", icon: "/onboarding/Style/Edgy.png", },
    { id: "Sporty", name: "Sporty", icon: "/onboarding/Style/Sporty.png", },
    { id: "Streetstyle", name: "Streetstyle", icon: "/onboarding/Style/Streetstyle.png", },
    { id: "Dopamine", name: "Dopamine", icon: "/onboarding/Style/Dopamine.png", },
    { id: "Y2K", name: "Y2K", icon: "/onboarding/Style/Y2K.png", },

];

export default function OnBoardingSix({ data, onUpdate, onValidationChange }: StepProps) {
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
            <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map((style) => {
                    const Icon = style.icon;
                    const isSelected = selectedStyles.includes(style.id);

                    return (
                        <button
                            key={style.id}
                            onClick={() => toggleStyle(style.id)}
                            className={cn(
                                "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 aspect-square relative border border-transparent hover:border-gray-300",
                                isSelected && "border-primary bg-primary/5"
                            )}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center z-10">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}

                            <div className="w-full h-5/6 mb-2 relative">
                                <img src={Icon} alt={style.name} className="w-full h-full object-cover object-top  rounded-lg border-2 border-gray-200" />
                            </div>
                            <span className="text-xs font-medium text-center leading-tight text-gray-500/70">
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