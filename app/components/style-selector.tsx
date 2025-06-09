"use client"
import { Check, Footprints, Heart, Palmtree, Briefcase, Sparkles, PartyPopper } from "lucide-react"
import { cn } from "@/lib/utils"

const styles = [
  { id: "running-outdoors", name: "Running Outdoors", icon: Footprints, color: "bg-emerald-100 text-emerald-900" },
  { id: "date-night", name: "Date Night", icon: Heart, color: "bg-rose-100 text-rose-900" },
  { id: "beach-day", name: "Beach Day", icon: Palmtree, color: "bg-sky-100 text-sky-900" },
  { id: "work-interview", name: "Work Interview", icon: Briefcase, color: "bg-slate-100 text-slate-900" },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles, color: "bg-violet-100 text-violet-900" },
  { id: "party-glam", name: "Party Glam", icon: PartyPopper, color: "bg-amber-100 text-amber-900" },
]

interface StyleSelectorProps {
  selectedStyle: string | null
  onStyleSelect: (styleId: string | null) => void
  className?: string
}

export default function StyleSelector({ selectedStyle, onStyleSelect, className }: StyleSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {styles.map((style) => {
          const isSelected = selectedStyle === style.id
          const Icon = style.icon

          return (
            <button
              key={style.id}
              onClick={() => onStyleSelect(isSelected ? null : style.id)}
              className={cn(
                "flex-shrink-0 relative rounded-xl p-3 text-center ios-btn transition-all duration-200 min-w-[80px]",
                style.color,
                isSelected ? "ring-2 ring-primary ring-offset-2 scale-105" : "hover:scale-102",
              )}
            >
              <div className="flex flex-col items-center justify-center h-full gap-1">
                <Icon size={24} />
                <span className="text-xs font-medium leading-tight">{style.name}</span>
              </div>

              {isSelected && (
                <span className="absolute -top-1 -right-1 bg-primary rounded-full p-1 shadow-sm">
                  <Check size={10} className="text-white" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedStyle && (
        <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-2">
          <span className="text-xs text-neutral-600">Selected: {styles.find((s) => s.id === selectedStyle)?.name}</span>
          <button onClick={() => onStyleSelect(null)} className="text-xs text-primary font-medium ios-btn">
            Use Original
          </button>
        </div>
      )}
    </div>
  )
}
