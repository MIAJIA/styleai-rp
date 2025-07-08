import { Button } from "@/components/ui/button"
import { QuickReplyAction } from "../types"

export function QuickReplyButtons({
  actions,
  onAction,
}: {
  actions: QuickReplyAction[]
  onAction: (action: QuickReplyAction) => void
}) {
  if (!actions || actions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {actions.map(action => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          className="rounded-full bg-white/80 backdrop-blur-lg"
          onClick={() => onAction(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}