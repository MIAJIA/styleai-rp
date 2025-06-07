"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Camera, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface IOSUploadProps {
  label: string
  onImageSelect: (file: File) => void
  preview?: string
  className?: string
  required?: boolean
  helpText?: string
}

export default function IOSUpload({
  label,
  onImageSelect,
  preview,
  className,
  required = false,
  helpText,
}: IOSUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files?.[0] && files[0].type.startsWith("image/")) {
      onImageSelect(files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      onImageSelect(files[0])
    }
  }

  const handleClearImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onImageSelect(null as unknown as File)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700">
          {label} {required && <span className="text-primary">*</span>}
        </label>
        {preview && (
          <button onClick={handleClearImage} className="text-xs text-neutral-500 flex items-center gap-1 ios-btn">
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-2xl transition-all duration-200 overflow-hidden",
          isDragging ? "border-primary bg-primary/5" : "border-neutral-200",
          preview ? "p-0" : "p-4",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative aspect-[4/3] w-full">
            <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm ios-btn"
            >
              <Camera size={18} className="text-neutral-700" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center text-center ios-btn"
          >
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mb-2">
              <Upload className="h-4 w-4 text-neutral-500" />
            </div>
            <p className="text-xs font-medium text-neutral-700 mb-1">Upload a photo</p>
            <p className="text-xs text-neutral-500 mb-2">Tap to browse</p>
            {helpText && <p className="text-xs text-neutral-500 mb-3 leading-relaxed text-center">{helpText}</p>}
            <Button variant="outline" size="sm" className="ios-btn-outline text-xs h-8 px-3">
              Choose File
            </Button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    </div>
  )
}
