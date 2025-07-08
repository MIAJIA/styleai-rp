import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface DebugPanelProps {
  sessionId: string
  isLoading: boolean
  isGenerating: boolean
  currentStep: string
  hasAutoStarted: boolean
  jobId: string | null
  chatData: object | null
  messagesLength: number
  pollingError: string | null
  finalPrompt: string
}

export function DebugPanel({
  sessionId,
  isLoading,
  isGenerating,
  currentStep,
  hasAutoStarted,
  jobId,
  chatData,
  messagesLength,
  pollingError,
  finalPrompt,
}: DebugPanelProps) {
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)

  // Conditional rendering based on environment
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <div
        className="bg-gray-100 rounded-lg cursor-pointer select-none"
        onClick={() => setIsDebugExpanded(!isDebugExpanded)}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h3 className="font-bold text-sm text-gray-700">Debug Info</h3>
          {isDebugExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {isDebugExpanded && (
        <div className="bg-gray-100 rounded-b-lg p-4 text-xs space-y-1">
          <div className="font-semibold text-gray-800 mb-2">🎯 Unified Chat States:</div>
          <div>sessionId: {sessionId}</div>
          <div>
            isLoading: <span className="font-bold">{String(isLoading)}</span>
          </div>
          <div className="font-semibold text-gray-800 mt-3 mb-2">📊 Generation States:</div>
          <div>
            isGenerating: <span className="font-bold">{String(isGenerating)}</span>
          </div>
          <div>
            currentStep: <span className="font-bold">{String(currentStep)}</span>
          </div>
          <div>hasAutoStarted: {String(hasAutoStarted)}</div>
          <div>pollingActive (has jobId): {jobId ? "yes" : "no"}</div>
          <div className="font-semibold text-gray-800 mt-3 mb-2">💾 Data States:</div>
          <div>chatData: {chatData ? "exists" : "null"}</div>
          <div>messages.length: {String(messagesLength)}</div>
          <div>pollingError: {pollingError || "none"}</div>
          <div className="font-semibold text-gray-800 mt-3 mb-2">💡 Final Prompt:</div>
          <div>{finalPrompt}</div>
        </div>
      )}
    </div>
  )
}