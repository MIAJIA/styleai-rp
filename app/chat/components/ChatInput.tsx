import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ImageIcon, Send } from "lucide-react"

interface ChatInputProps {
  stagedImage: string | null
  isImageProcessing: boolean
  handleSendMessage: (message: string) => void
  handleImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  clearStagedImage: () => void
  handleImageUploadClick: () => void
}

export function ChatInput({
  stagedImage,
  isImageProcessing,
  handleSendMessage,
  handleImageSelect,
  clearStagedImage,
  handleImageUploadClick,
}: ChatInputProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)

  return (
    <footer className="p-4 bg-white border-t border-gray-200">
      <div className="max-w-2xl mx-auto">
        {/* Staged image preview */}
        {stagedImage && (
          <div className="mb-2 relative w-24 h-24">
            <img
              src={stagedImage || "/placeholder.svg"}
              alt="Preview"
              className="w-full h-full object-cover rounded-lg"
            />
            <button
              onClick={clearStagedImage}
              className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg"
              aria-label="Remove image"
            >
              X
            </button>
          </div>
        )}

        {/* Image processing indicator */}
        {isImageProcessing && (
          <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-700">正在优化图片...</span>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const message = (e.target as HTMLFormElement).message.value
            if (!message.trim() && !stagedImage) return
            handleSendMessage(message)
              ; (e.target as HTMLFormElement).reset()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageSelect}
            className="hidden"
            accept="image/*"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            disabled={isImageProcessing}
            aria-label="Upload image"
          >
            {isImageProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <ImageIcon className="w-5 h-5 text-gray-500" />
            )}
          </Button>
          <input
            name="message"
            placeholder="Talk to your personal stylist..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF6EC7] text-sm"
            autoComplete="off"
          />
          <Button
            type="submit"
            className="bg-[#FF6EC7] hover:bg-[#ff5bb0] rounded-full"
            size="icon"
            aria-label="Send message"
          >
            <Send className="w-5 h-5 text-white" />
          </Button>
        </form>
      </div>
    </footer>
  )
}