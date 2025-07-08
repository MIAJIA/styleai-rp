import { Button } from "@/components/ui/button"

export function QuickReplyButtons({
  suggestions,
  onSelect,
}: {
  suggestions: string[]
  onSelect: (suggestion: string) => void
}) {
  if (!suggestions || suggestions.length === 0) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto mt-2 mb-4 px-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="rounded-full bg-white/80 backdrop-blur-lg"
            onClick={() => onSelect(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  )
}