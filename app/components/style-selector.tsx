"use client"
import { Check, Footprints, Heart, Palmtree, Briefcase, Sparkles, PartyPopper, BookOpen, Coffee, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

const styles = [
  { id: "fashion-magazine", name: "Magazine", icon: BookOpen, color: "bg-pink-100 text-pink-900" },
  { id: "running-outdoors", name: "Outdoors", icon: Footprints, color: "bg-emerald-100 text-emerald-900" },
  { id: "coffee-shop", name: "Coffee", icon: Coffee, color: "bg-amber-100 text-amber-900" },
  { id: "music-show", name: "Music Show", icon: Mic, color: "bg-purple-100 text-purple-900" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900" },
  { id: "beach-day", name: "Beach Day", icon: Palmtree, color: "bg-sky-100 text-sky-900" },
  // { id: "work-interview", name: "Work Interview", icon: Briefcase, color: "bg-slate-100 text-slate-900" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900" },
  { id: "party-glam", name: "Party Glam", icon: PartyPopper, color: "bg-amber-100 text-amber-900" },
]

interface StyleSelectorProps {
  selectedStyle: string | null
  isGenerating: boolean
  onStyleSelect: (styleId: string) => void
  className?: string
}

export default function StyleSelector({ selectedStyle, isGenerating, onStyleSelect, className }: StyleSelectorProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {styles.map((style) => {
        const Icon = style.icon
        const isLoading = isGenerating && selectedStyle === style.id

        return (
          <button
            key={style.id}
            onClick={() => onStyleSelect(style.id)}
            disabled={isGenerating}
            className={cn(
              "flex-shrink-0 relative rounded-xl p-2 text-center ios-btn transition-all duration-200 aspect-square flex flex-col items-center justify-center gap-1.5",
              style.color,
              isGenerating && !isLoading ? "opacity-60 cursor-not-allowed" : "hover:scale-105",
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
        )
      })}
    </div>
  )
}
