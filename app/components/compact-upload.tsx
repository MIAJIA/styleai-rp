"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, X, Camera } from "lucide-react"

interface CompactUploadProps {
  label: string
  onImageSelect?: (file: File) => void
  preview: string
  required?: boolean
  helpText?: string
  variant?: "portrait" | "garment"
  isTrigger?: boolean
}

export default function CompactUpload({
  label,
  onImageSelect,
  preview,
  required = false,
  helpText,
  variant = "portrait",
  isTrigger = false,
}: CompactUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImageSelect?.(file)
    }
  }

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
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onImageSelect?.(file)
    }
  }

  const handleClear = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onImageSelect?.(new File([], ""))
  }

  const bgColor = variant === "portrait" ? "bg-[#FF6EC7]" : "bg-[#00C2FF]"

  return (
    <div className="relative w-full">
      <div
        className={`${bgColor} rounded-[32px] p-3 shadow-lg transform transition-transform hover:scale-[1.02] ${isDragging ? "ring-2 ring-white" : ""
          }`}
      >
        <div
          className="aspect-square relative overflow-hidden rounded-[24px] bg-white cursor-pointer"
          onClick={() => !isTrigger && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {preview ? (
            <>
              <img
                src={preview || "/placeholder.svg"}
                alt={`${label} preview`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Clear image"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#D5F500] flex items-center justify-center mb-2">
                {variant === "portrait" ? (
                  <Camera size={24} className="text-black" />
                ) : (
                  <Upload size={24} className="text-black" />
                )}
              </div>
              <h3 className="font-playfair text-lg font-bold text-neutral-800 mb-1">{label}</h3>
              {helpText && <p className="text-xs text-neutral-500 font-inter">{helpText}</p>}
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        required={required}
      />
    </div>
  )
}
