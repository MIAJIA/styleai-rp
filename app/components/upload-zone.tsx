"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Camera, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UploadZoneProps {
  onImageUpload: (file: File) => void
  label: string
  preview?: string
}

export default function UploadZone({ onImageUpload, label, preview }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files[0] && files[0].type.startsWith("image/")) {
      onImageUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      onImageUpload(files[0])
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${
          isDragging ? "border-rose-400 bg-rose-50" : "border-gray-200 hover:border-rose-300"
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
      >
        {preview ? (
          <div className="relative">
            <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/90 hover:bg-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} />
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-3">Drag & drop or tap to upload</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              Choose Photo
            </Button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </div>
    </div>
  )
}
