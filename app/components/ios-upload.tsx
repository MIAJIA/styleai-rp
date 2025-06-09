"use client"

import React, { useRef, useState, ChangeEvent } from "react"
import { Upload, X } from "lucide-react"

// Helper function to process and resize the image if necessary
const processImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = img;
        const aspectRatio = width / height;
        const minRatio = 1 / 2.5; //  0.4
        const maxRatio = 2.5;

        // If aspect ratio is valid, no need to process
        if (aspectRatio >= minRatio && aspectRatio <= maxRatio) {
          console.log("Image aspect ratio is valid, no processing needed.");
          resolve(file);
          return;
        }

        console.log("Image aspect ratio is invalid, processing with intelligent cropping...");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        let sx = 0, sy = 0, sWidth = width, sHeight = height;

        if (aspectRatio < minRatio) { // Image is too tall, crop from the top
          sHeight = width / minRatio; // New height that fits the min ratio
          canvas.width = width;
          canvas.height = sHeight;
          // sx, sy remain 0, sWidth remains width
        } else { // Image is too wide, crop from the center
          sWidth = height * maxRatio; // New width that fits the max ratio
          sx = (width - sWidth) / 2; // Start cropping from the horizontal center
          canvas.width = sWidth;
          canvas.height = height;
          // sy remains 0, sHeight remains height
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Canvas to Blob conversion failed'));
          }
          const newFile = new File([blob], file.name, { type: file.type });
          console.log(`Image processed successfully. Original: ${width}x${height}, New: ${canvas.width}x${canvas.height}`);
          resolve(newFile);
        }, file.type);
      };
      img.onerror = reject;
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface IOSUploadProps {
  label: string
  onImageSelect: (file: File) => void
  preview: string
  required?: boolean
  helpText?: string
}

export default function IOSUpload({
  label,
  onImageSelect,
  preview,
  required,
  helpText,
}: IOSUploadProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsProcessing(true);
      try {
        const processedFile = await processImage(file);
        onImageSelect(processedFile);
      } catch (err) {
        console.error("Image processing failed:", err);
        setError("Could not process the image. Please try another one.");
        // Reset the input so the user can select the same file again if they wish
        if (ref.current) {
          ref.current.value = "";
        }
      } finally {
        setIsProcessing(false);
      }
    }
  }

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (ref.current) {
      ref.current.value = ""
    }
    // Create a dummy file to reset the state
    onImageSelect(new File([], ""));
  }

  return (
    <div
      className="ios-uploader relative aspect-[3/4] bg-neutral-100 rounded-lg flex flex-col items-center justify-center text-center p-3 cursor-pointer"
      onClick={() => ref.current?.click()}
    >
      <input type="file" accept="image/jpeg,image/png" className="hidden" ref={ref} onChange={onFileChange} />
      {preview ? (
        <>
          <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-md" />
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center">
            <Upload size={20} className="text-neutral-500" />
          </div>
          <span className="text-xs font-medium">
            {label}
            {required && <span className="text-red-500">*</span>}
          </span>
        </div>
      )}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <div className="text-white">Processing...</div>
        </div>
      )}
      {helpText && (
        <p className="absolute bottom-2 text-neutral-400 text-[10px] leading-tight px-2">{helpText}</p>
      )}
      {error && (
        <div className="absolute bottom-2 text-red-500 text-[10px] leading-tight px-2">{error}</div>
      )}
    </div>
  )
}
