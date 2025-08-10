"use client";
import {
  Check,
  Heart,
  Briefcase,
  Sparkles,
  Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";

const styles = [
  { id: "work", name: "Work", icon: Briefcase, color: "bg-slate-100 text-slate-900" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900" },
  { id: "vacation", name: "Vacation", icon: Plane, color: "bg-sky-100 text-sky-900" },
];

interface StyleSelectorProps {
  selectedStyle: string | null;
  isGenerating: boolean;
  onStyleSelect: (styleId: string) => void;
  className?: string;
}

export default function StyleSelector({
  selectedStyle,
  isGenerating,
  onStyleSelect,
  className,
}: StyleSelectorProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {styles.map((style) => {
        const Icon = style.icon;
        const isSelected = selectedStyle === style.id;
        const isLoading = isGenerating && isSelected;

        return (
          <button
            key={style.id}
            onClick={() => onStyleSelect(style.id)}
            disabled={isGenerating}
            className={cn(
              "flex-shrink-0 relative rounded-xl p-2 text-center ios-btn transition-all duration-200 aspect-square flex flex-col items-center justify-center gap-1.5",
              style.color,
              isGenerating && !isSelected ? "opacity-60 cursor-not-allowed" : "hover:scale-105",
              isSelected && !isGenerating ? "ring-2 ring-primary/50 ring-offset-2" : "",
              isLoading ? "ring-2 ring-primary ring-offset-2" : "",
            )}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium leading-tight">{style.name}</span>
              </>
            ) : (
              <>
                <Icon size={22} />
                <span className="text-xs font-medium leading-tight">{style.name}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
