"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { OnboardingData } from "@/lib/onboarding-storage";
import { StepProps } from "./on-boarding-step";


export default function OnBoardingFirst({ data, onUpdate, onValidationChange }: StepProps) {
    const [selectedOption, setSelectedOption] = useState<string>("");
    
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (data.userGoal) {
            setSelectedOption(data.userGoal.hasStylingDifficulty ? "totally" : "not-totally");
        }
    }, [data.userGoal]);

    // Update validation when selection changes
    useEffect(() => {
        if (selectedOption !== "") {
            onValidationChange(true);
            // Only update if the value has actually changed
            const newHasStylingDifficulty = selectedOption === "totally";
            if (!data.userGoal || data.userGoal.hasStylingDifficulty !== newHasStylingDifficulty) {
                onUpdate({
                    userGoal: {
                        hasStylingDifficulty: newHasStylingDifficulty, 
                        styleFocus: ["elevate_outfits",
                            "discover_flattering_silhouettes",
                            "special_event_outfits"]
                    }
                });
            }
        } else {
            onValidationChange(false);
        }
    }, [selectedOption, data.userGoal]);



    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    Do you have clothes that you don’t know how to style?
                </h2>

            </div>

            <div className="flex justify-left">
                <RadioGroup
                    value={selectedOption}
                    onValueChange={setSelectedOption}
                    className="space-y-3"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="totally" id="totally" />
                        <Label htmlFor="totally" className="text-lg">Totally</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="not-totally" id="not-totally" />
                        <Label htmlFor="not-totally" className="text-lg">Not Really</Label>
                    </div>
                </RadioGroup>
            </div>

        </div>
    )
}