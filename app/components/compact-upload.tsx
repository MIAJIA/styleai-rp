"use client";

import type React from "react";

import { useState, useRef } from "react";
import { Upload, X, Camera, UploadCloud, Image as ImageIcon, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactUploadProps {
  label?: string;
  onImageSelect?: (file: File) => void;
  preview: string;
  required?: boolean;
  helpText?: string;
  variant?: "portrait" | "garment" | "garment-square";
  isTrigger?: boolean;
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isTrigger) setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (!isTrigger) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isTrigger) return;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleClear = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onImageSelect) {
      onImageSelect(new File([], ""));
    }
  };

  const bgColor = variant === "portrait" ? "bg-[#FF6EC7]" : "bg-[#00C2FF]";
  const Icon = variant === "portrait" ? ImageIcon : Shirt;

  return (
    <div className="relative w-full">
      <div
        className={`${bgColor} rounded-[32px] p-3 shadow-lg transform transition-transform hover:scale-[1.02] ${
          isDragging ? "ring-2 ring-white" : ""
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
                src={preview}
                alt={`${label || "Upload"} preview`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2 right-2 p-1 bg-white rounded-full"
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
              {label && (
                <h3 className="font-playfair text-lg font-bold text-neutral-800 mb-1">{label}</h3>
              )}
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
  );
}
