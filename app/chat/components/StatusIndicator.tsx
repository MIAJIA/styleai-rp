import { Loader2 } from "lucide-react"

interface StatusIndicatorProps {
  isGenerating: boolean
  isLoading: boolean
  isImageProcessing: boolean
  generationStatusText: string | null
}

export function StatusIndicator({
  isGenerating,
  isLoading,
  isImageProcessing,
  generationStatusText,
}: StatusIndicatorProps) {
  if (!isGenerating && !isLoading && !isImageProcessing) {
    return null
  }

  return (
    <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600 font-medium">
              {(() => {
                if (isImageProcessing) return "Optimizing your image so it looks fab and loads fast…"
                if (isGenerating) {
                  const status = generationStatusText || "Making your styling magic happen—stay tuned!"
                  const prompt = "While you wait, feel free to ask me anything else!"
                  return (
                    <span>
                      {status}
                      <span className="text-gray-500 font-normal italic mt-1 block">{prompt}</span>
                    </span>
                  )
                }
                if (isLoading) {
                  const status = "Thinking through your look—this one's gonna be good…"
                  const prompt = "We can keep chatting while I think."
                  return (
                    <span>
                      {status}
                      <span className="text-gray-500 font-normal italic mt-1 block">{prompt}</span>
                    </span>
                  )
                }
                return null
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}