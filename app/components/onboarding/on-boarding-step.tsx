import { OnboardingData } from "@/lib/onboarding-storage";

export interface StepProps {
    data: OnboardingData;
    onUpdate: (data: Partial<OnboardingData>) => void;
    onValidationChange: (isValid: boolean) => void;
}
