"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Plus, X } from "lucide-react"

// Props for the component
interface PortraitSelectionSheetProps {
  onPortraitSelect: (imageSrc: string) => void
}

// Data structure for a single portrait
interface Portrait {
  id: string
  imageSrc: string
}

// Pre-defined example photos to show if the user has none
const EXAMPLE_PHOTOS: Portrait[] = [
  { id: "example-1", imageSrc: "/examples/example_刘大壮.jpg" },
  { id: "example-2", imageSrc: "/examples/example_李大可.jpg" },
  { id: "example-3", imageSrc: "/examples/example_王大可.jpg" },
];

// Using the real idol images now located in /public/idols
const DEFAULT_IDOLS: Portrait[] = [
  { id: "idol-1", imageSrc: "/idols/idol_肖战.jpg" },
  { id: "idol-2", imageSrc: "/idols/idol_彭于晏全身.png" },
  { id: "idol-3", imageSrc: "/idols/idol_刘亦菲_牛仔.jpg" },
]

const MY_PHOTOS_STORAGE_KEY = "styleai_portraits"
const IDOLS_STORAGE_KEY = "styleai_idols"

// New constant for the visual styles of the portrait categories
const PORTRAIT_CATEGORY_STYLES = {
  myPhotos: {
    bg: "bg-[#FF6EC7]", // Re-using a theme color
    emoji: "📸",
    label: "My Photos",
  },
  idols: {
    bg: "bg-[#00C2FF]", // Re-using another theme color
    emoji: "⭐",
    label: "Idols",
  },
}

export default function PortraitSelectionSheet({ onPortraitSelect }: PortraitSelectionSheetProps) {
  const [myPhotos, setMyPhotos] = useState<Portrait[]>([])
  const [idols, setIdols] = useState<Portrait[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeCategory, setActiveCategory] = useState<"myPhotos" | "idols" | null>(null)

  // Load photos from localStorage on mount
  useEffect(() => {
    try {
      const storedMyPhotos = window.localStorage.getItem(MY_PHOTOS_STORAGE_KEY)
      if (storedMyPhotos) setMyPhotos(JSON.parse(storedMyPhotos))

      const storedIdols = window.localStorage.getItem(IDOLS_STORAGE_KEY)
      if (storedIdols) setIdols(JSON.parse(storedIdols))
    } catch (error) {
      console.error("Failed to parse photos from localStorage", error)
    }
  }, [])

  // Save myPhotos to localStorage when they change
  useEffect(() => {
    if (myPhotos.length > 0 && !myPhotos.every(p => p.id.startsWith('example-'))) {
      try {
        window.localStorage.setItem(MY_PHOTOS_STORAGE_KEY, JSON.stringify(myPhotos));
      } catch (error) {
        console.error("Failed to save my photos to localStorage", error);
      }
    }
  }, [myPhotos])

  // Save idols to localStorage when they change
  useEffect(() => {
    if (idols.length > 0 && !idols.every(p => p.id.startsWith('idol-'))) {
      try {
        window.localStorage.setItem(IDOLS_STORAGE_KEY, JSON.stringify(idols));
      } catch (error) {
        console.error("Failed to save idols to localStorage", error);
      }
    }
  }, [idols])

  const processAndResizeImage = async (file: File): Promise<string | null> => {
    // This is the same battle-tested image resizing logic from the wardrobe
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Invalid file format. Please upload a JPG or PNG image.")
      return null
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload an image smaller than 10MB.")
      return null
    }

    return new Promise((resolve) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(img.src)
        if (img.width < 300 || img.height < 300) {
          alert("Image dimensions too small. Please use an image at least 300x300 pixels.")
          resolve(null)
          return
        }

        const canvas = document.createElement("canvas")
        const MAX_DIMENSION = 1024
        let { width, height } = img
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width
            width = MAX_DIMENSION
          }
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height
          height = MAX_DIMENSION
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = () => resolve(null)
    })
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && activeCategory) {
      const imageSrc = await processAndResizeImage(file)
      if (imageSrc) {
        const newPortrait: Portrait = { id: `portrait-${Date.now()}`, imageSrc }
        if (activeCategory === 'myPhotos') {
          setMyPhotos((prev) => [newPortrait, ...prev.filter(p => !p.id.startsWith('example-'))])
        } else if (activeCategory === 'idols') {
          setIdols((prev) => [newPortrait, ...prev.filter(p => !p.id.startsWith('idol-'))])
        }
      }
    }
    if (event.target) event.target.value = ""
    setActiveCategory(null)
  }

  const handleDelete = (portraitId: string, category: 'myPhotos' | 'idols') => {
    const confirmation = window.confirm("Are you sure you want to delete this photo?")
    if (confirmation) {
      if (category === 'myPhotos') {
        setMyPhotos((prev) => prev.filter((p) => p.id !== portraitId));
      } else {
        setIdols((prev) => prev.filter((p) => p.id !== portraitId));
      }
    }
  }

  const handleAddClick = (category: 'myPhotos' | 'idols') => {
    setActiveCategory(category)
    fileInputRef.current?.click()
  }

  const renderPhotoGrid = (
    photos: Portrait[],
    category: 'myPhotos' | 'idols'
  ) => (
    <div className="grid grid-cols-3 gap-3">
      <div
        onClick={() => handleAddClick(category)}
        className="aspect-square bg-white/30 rounded-xl shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center mb-1">
          <span className="text-2xl text-white">+</span>
        </div>
        <p className="text-xs text-white font-medium">Add Photo</p>
      </div>
      {photos.map((photo, index) => (
        <div
          key={photo.id + index}
          className="relative group aspect-square bg-white rounded-xl shadow-sm cursor-pointer overflow-hidden"
        >
          <button
            onClick={() => onPortraitSelect(photo.imageSrc)}
            className="w-full h-full bg-white rounded-lg overflow-hidden"
          >
            <img
              src={photo.imageSrc}
              alt="Portrait"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(photo.id, category)
            }}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-red-500"
            aria-label="Delete photo"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )

  // New function to render a styled category block, similar to the wardrobe
  const renderCategory = (type: "myPhotos" | "idols") => {
    const isIdol = type === "idols"

    const userPhotos = isIdol ? idols : myPhotos;
    const defaultPhotos = isIdol ? DEFAULT_IDOLS : EXAMPLE_PHOTOS;

    const photosToDisplay = [...userPhotos, ...defaultPhotos.filter(ex => !userPhotos.some(p => p.imageSrc === ex.imageSrc))];
    const { bg, emoji, label } = PORTRAIT_CATEGORY_STYLES[type]

    return (
      <div className={`${bg} rounded-3xl p-4 shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-lg">{emoji}</span>
            </div>
            <span className="font-playfair text-base font-bold text-white">{label}</span>
          </div>
          <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs font-sans font-medium text-white">
            {photosToDisplay.length}
          </span>
        </div>
        {renderPhotoGrid(photosToDisplay, type)}
      </div>
    )
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      {/* Container to ensure vertical stacking */}
      <div className="flex flex-col gap-y-4">
        {renderCategory("myPhotos")}
        {renderCategory("idols")}
      </div>
    </div>
  )
}