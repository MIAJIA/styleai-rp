"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

// Define the structure of a wardrobe item and the whole wardrobe
interface WardrobeItem {
  id: string
  imageSrc: string
}

type WardrobeCategory = "tops" | "bottoms" | "dresses" | "outerwear"

interface Wardrobe {
  tops: WardrobeItem[]
  bottoms: WardrobeItem[]
  dresses: WardrobeItem[]
  outerwear: WardrobeItem[]
}

// Define the props for the component
interface StylishWardrobeProps {
  onGarmentSelect: (imageSrc: string) => void
}

const STORAGE_KEY = "styleai_wardrobe"
const INITIAL_WARDROBE: Wardrobe = {
  tops: [],
  bottoms: [],
  dresses: [],
  outerwear: [],
}

// Helper function to read from localStorage safely
const getInitialState = (): Wardrobe => {
  if (typeof window === "undefined") {
    return INITIAL_WARDROBE
  }
  try {
    const storedItem = window.localStorage.getItem(STORAGE_KEY)
    if (storedItem) {
      return JSON.parse(storedItem)
    }
  } catch (error) {
    console.error("Failed to parse wardrobe from localStorage", error)
  }
  return INITIAL_WARDROBE
}

const CATEGORY_STYLES = {
  tops: {
    bg: "bg-[#FF6EC7]",
    emoji: "👕",
    label: "Tops",
  },
  bottoms: {
    bg: "bg-[#00C2FF]",
    emoji: "👖",
    label: "Bottoms",
  },
  dresses: {
    bg: "bg-[#D5F500]",
    emoji: "👗",
    label: "Dresses",
  },
  outerwear: {
    bg: "bg-[#FF9B3E]",
    emoji: "🧥",
    label: "Outerwear",
  },
}

export default function StylishWardrobe({ onGarmentSelect }: StylishWardrobeProps) {
  const [wardrobe, setWardrobe] = useState<Wardrobe>(getInitialState)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentCategoryRef = useRef<WardrobeCategory | null>(null)

  // Effect to persist wardrobe changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobe))
    } catch (error) {
      console.error("Failed to save wardrobe to localStorage", error)
    }
  }, [wardrobe])

  const processAndResizeImage = async (file: File): Promise<string | null> => {
    // 1. Validate file type
    const allowedTypes = ["image/jpeg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file format. Please upload a JPG or PNG image.")
      return null
    }

    // 2. Validate file size (max 10MB) - this is for the RAW upload
    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      alert("File is too large. Please upload an image smaller than 10MB.")
      return null
    }

    // 3. Resize the image to a thumbnail and validate original dimensions
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (img.width < 300 || img.height < 300) {
          alert("Image dimensions are too small. Please use an image that is at least 300x300 pixels.")
          URL.revokeObjectURL(objectUrl)
          resolve(null)
          return
        }

        // Create canvas for resizing
        const canvas = document.createElement("canvas")
        const MAX_DIMENSION = 1024 // Increased from 512 to 1024 for higher quality
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width
            width = MAX_DIMENSION
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height
            height = MAX_DIMENSION
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          alert("Could not get canvas context for resizing.")
          URL.revokeObjectURL(objectUrl)
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // Get the resized image as a JPEG Data URL (more efficient for photos)
        const resizedImageSrc = canvas.toDataURL("image/jpeg", 0.85) // Use JPEG with 85% quality
        URL.revokeObjectURL(objectUrl)
        resolve(resizedImageSrc)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        alert("Could not read image file. It might be corrupted.")
        resolve(null)
      }
      img.src = objectUrl
    })
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const category = currentCategoryRef.current

    if (file && category) {
      const imageSrc = await processAndResizeImage(file) // Use the new resizing function
      if (imageSrc) {
        const newItem: WardrobeItem = {
          id: `item-${Date.now()}`,
          imageSrc,
        }
        setWardrobe((prev) => ({
          ...prev,
          [category]: [...prev[category], newItem],
        }))
      }
    }

    // Reset the input value to allow uploading the same file again
    if (event.target) {
      event.target.value = ""
    }
  }

  const handleAddClick = (category: WardrobeCategory) => {
    currentCategoryRef.current = category
    fileInputRef.current?.click()
  }

  const handleDeleteItem = (category: WardrobeCategory, itemId: string) => {
    // Add a confirmation dialog to prevent accidental deletion
    if (window.confirm("Are you sure you want to delete this item?")) {
      setWardrobe((prev) => {
        const updatedItems = prev[category].filter((item) => item.id !== itemId)
        return {
          ...prev,
          [category]: updatedItems,
        }
      })
    }
  }

  // This is a simplified render function for one category.
  // We will build this out with proper styling.
  const renderCategory = (category: WardrobeCategory) => {
    const items = wardrobe[category]
    const { bg, emoji, label } = CATEGORY_STYLES[category]

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
            {items.length}
          </span>
        </div>
        {/* Responsive Grid: 2 cols on mobile, 3 on sm screens, 4 on lg screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onGarmentSelect(item.imageSrc)}
              className="relative group aspect-square bg-white rounded-xl shadow-sm cursor-pointer overflow-hidden"
            >
              <img
                src={item.imageSrc || "/placeholder.svg"}
                alt="wardrobe item"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                onClick={(e) => {
                  e.stopPropagation() // Prevent the main card's click event
                  handleDeleteItem(category, item.id)
                }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-red-500 transform hover:scale-110"
                aria-label="Delete item"
              >
                ✕
              </button>
            </div>
          ))}
          {/* A single, clear "Add" button at the end of the list */}
          <div
            onClick={() => handleAddClick(category)}
            className="aspect-square bg-white/30 rounded-xl shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center mb-1">
              <span className="text-2xl text-white">+</span>
            </div>
            <p className="text-xs text-white font-medium">Add New</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Hidden file input to be triggered programmatically */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png"
        style={{ display: "none" }}
      />

      <div className="rounded-3xl p-6 bg-white shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-playfair text-xl font-bold text-neutral-900">My Wardrobe</h2>
          <Link
            href="/wardrobe"
            className="px-4 py-1.5 bg-[#D5F500] rounded-full text-sm font-inter font-medium text-black"
          >
            Manage
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {renderCategory("tops")}
          {renderCategory("bottoms")}
          {renderCategory("dresses")}
          {renderCategory("outerwear")}
        </div>
      </div>
    </>
  )
}
