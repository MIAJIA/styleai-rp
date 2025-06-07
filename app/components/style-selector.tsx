"use client"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const styles = [
  { id: "date-night", name: "Date Night", emoji: "🌹", color: "bg-rose-100 text-rose-900" },
  { id: "beach-day", name: "Beach Day", emoji: "🏖️", color: "bg-sky-100 text-sky-900" },
  { id: "work-interview", name: "Work Interview", emoji: "💼", color: "bg-slate-100 text-slate-900" },
  { id: "casual-chic", name: "Casual Chic", emoji: "✨", color: "bg-violet-100 text-violet-900" },
  { id: "party-glam", name: "Party Glam", emoji: "🎉", color: "bg-amber-100 text-amber-900" },
]

interface StyleSelectorProps {
  selectedStyle: string | null
  onStyleSelect: (styleId: string) => void
  className?: string
}

export default function StyleSelector({ selectedStyle, onStyleSelect, className }: StyleSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-neutral-700">Choose Your Style</label>

      <div className="grid grid-cols-2 gap-3">
        {styles.map((style) => {
          const isSelected = selectedStyle === style.id

          return (
            <button
              key={style.id}
              onClick={() => onStyleSelect(style.id)}
              className={cn(
                "relative rounded-xl p-3 text-left ios-btn transition-all duration-200",
                style.color,
                isSelected ? "ring-2 ring-primary ring-offset-2" : "",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xl block mb-1">{style.emoji}</span>
                  <span className="text-sm font-medium">{style.name}</span>
                </div>

                {isSelected && (
                  <span className="bg-white rounded-full p-0.5 shadow-sm">
                    <Check size={14} className="text-primary" />
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
