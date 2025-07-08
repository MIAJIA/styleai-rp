import { useState, useRef } from "react"

export function useImageHandling() {
  const [stagedImage, setStagedImage] = useState<string | null>(null)
  const [isImageProcessing, setIsImageProcessing] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageUploadClick = () => {
    imageInputRef.current?.click()
  }

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log(`[useImageHandling] Image selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("Image too large (>50MB), please select a smaller image")
      return
    }

    setIsImageProcessing(true)

    try {
      let compressionResult
      if (file.size > 10 * 1024 * 1024) {
        console.log("[useImageHandling] Using aggressive compression for large file")
        compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
      } else {
        console.log("[useImageHandling] Using standard compression")
        compressionResult = await import("@/lib/image-compression").then((m) => m.compressForChat(file))
      }

      console.log(
        `[useImageHandling] Image compression complete: ${(file.size / 1024).toFixed(1)}KB → ${(
          compressionResult.compressedSize / 1024
        ).toFixed(1)}KB (reduced ${(compressionResult.compressionRatio * 100).toFixed(1)}%)`,
      )

      setStagedImage(compressionResult.dataUrl)
    } catch (error) {
      console.error("[useImageHandling] Image compression failed:", error)
      if (file.size < 5 * 1024 * 1024) {
        console.log("[useImageHandling] Compression failed, using original image")
        const reader = new FileReader()
        reader.onloadend = () => {
          setStagedImage(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        alert("Image processing failed, please try again or select a smaller image")
      }
    } finally {
      setIsImageProcessing(false)
    }

    event.target.value = ""
  }

  const clearStagedImage = () => {
    setStagedImage(null)
  }

  return {
    stagedImage,
    setStagedImage,
    isImageProcessing,
    imageInputRef,
    handleImageUploadClick,
    handleImageSelect,
    clearStagedImage,
  }
}