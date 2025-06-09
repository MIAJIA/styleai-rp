"use client"

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Define the structure of a wardrobe item and the whole wardrobe
interface WardrobeItem {
  id: string;
  imageSrc: string;
}

type WardrobeCategory = "tops" | "bottoms" | "dresses" | "outerwear";

interface Wardrobe {
  tops: WardrobeItem[];
  bottoms: WardrobeItem[];
  dresses: WardrobeItem[];
  outerwear: WardrobeItem[];
}

// Define the props for the component
interface MyWardrobeProps {
  onGarmentSelect: (imageSrc: string) => void;
}

const STORAGE_KEY = 'styleai_wardrobe';
const INITIAL_WARDROBE: Wardrobe = {
  tops: [],
  bottoms: [],
  dresses: [],
  outerwear: [],
};

// Helper function to read from localStorage safely
const getInitialState = (): Wardrobe => {
  if (typeof window === "undefined") {
    return INITIAL_WARDROBE;
  }
  try {
    const storedItem = window.localStorage.getItem(STORAGE_KEY);
    if (storedItem) {
      return JSON.parse(storedItem);
    }
  } catch (error) {
    console.error("Failed to parse wardrobe from localStorage", error);
  }
  return INITIAL_WARDROBE;
};

export default function MyWardrobe({ onGarmentSelect }: MyWardrobeProps) {
  const [wardrobe, setWardrobe] = useState<Wardrobe>(getInitialState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentCategoryRef = useRef<WardrobeCategory | null>(null);

  // Effect to persist wardrobe changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobe));
    } catch (error) {
      console.error("Failed to save wardrobe to localStorage", error);
    }
  }, [wardrobe]);

  // --- Start: New validation AND RESIZING logic ---

  const processAndResizeImage = async (file: File): Promise<string | null> => {
    // 1. Validate file type
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file format. Please upload a JPG or PNG image.');
      return null;
    }

    // 2. Validate file size (max 10MB) - this is for the RAW upload
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      alert('File is too large. Please upload an image smaller than 10MB.');
      return null;
    }

    // 3. Resize the image to a thumbnail and validate original dimensions
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (img.width < 300 || img.height < 300) {
          alert('Image dimensions are too small. Please use an image that is at least 300x300 pixels.');
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          alert('Could not get canvas context for resizing.');
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Get the resized image as a JPEG Data URL (more efficient for photos)
        const resizedImageSrc = canvas.toDataURL('image/jpeg', 0.85); // Use JPEG with 85% quality
        URL.revokeObjectURL(objectUrl);
        resolve(resizedImageSrc);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        alert('Could not read image file. It might be corrupted.');
        resolve(null);
      };
      img.src = objectUrl;
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const category = currentCategoryRef.current;

    if (file && category) {
      const imageSrc = await processAndResizeImage(file); // Use the new resizing function
      if (imageSrc) {
        const newItem: WardrobeItem = {
          id: `item-${Date.now()}`,
          imageSrc,
        };
        setWardrobe(prev => ({
          ...prev,
          [category]: [...prev[category], newItem],
        }));
      }
    }

    // Reset the input value to allow uploading the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  // --- End: New validation and resizing logic ---

  const handleAddClick = (category: WardrobeCategory) => {
    currentCategoryRef.current = category;
    fileInputRef.current?.click();
  };

  // This is a simplified render function for one category.
  // We will build this out with proper styling.
  const renderCategory = (category: WardrobeCategory, name: string, emoji: string, colorClass: string) => {
    const items = wardrobe[category];
    const totalSlots = 3; // Let's show 3 slots per category for now

    return (
      <div className={`flex-1 bg-gradient-to-br ${colorClass} rounded-xl p-3 border border-pink-100`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-pink-700">{name}</span>
          <span className="text-xs text-pink-500">{items.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {items.slice(0, totalSlots).map((item) => (
            <div
              key={item.id}
              onClick={() => onGarmentSelect(item.imageSrc)}
              className="aspect-square bg-white rounded-md shadow-sm cursor-pointer"
            >
              <img src={item.imageSrc} alt="wardrobe item" className="w-full h-full object-cover rounded-md" />
            </div>
          ))}
          {Array.from({ length: Math.max(0, totalSlots - items.length) }).map((_, index) => (
            <div
              key={`add-${category}-${index}`}
              onClick={() => handleAddClick(category)}
              className="aspect-square bg-white/50 rounded-md shadow-sm flex items-center justify-center cursor-pointer hover:bg-white/70"
            >
              <span className="text-lg text-black/50">{emoji}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden file input to be triggered programmatically */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png"
        style={{ display: 'none' }}
      />

      <div className="ios-card p-5 animate-fade-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs">👗</span>
            </div>
            <h3 className="text-sm font-medium">My Wardrobe</h3>
          </div>
          <Link href="/wardrobe" className="text-xs text-primary font-medium ios-btn">
            Manage
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            {renderCategory("tops", "Tops", "👕", "from-pink-50 to-rose-50")}
            {renderCategory("bottoms", "Bottoms", "👖", "from-blue-50 to-indigo-50")}
          </div>
          <div className="flex gap-3">
            {renderCategory("dresses", "Dresses", "👗", "from-purple-50 to-violet-50")}
            {renderCategory("outerwear", "Outerwear", "🧥", "from-emerald-50 to-green-50")}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-100">
          <button
            onClick={() => handleAddClick('tops')} // Default to adding a top or have a dedicated button
            className="flex items-center justify-center gap-2 py-2 px-4 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors ios-btn w-full"
          >
            <span className="text-lg">➕</span>
            <span className="text-xs font-medium text-neutral-600">Add New Item</span>
          </button>
        </div>
      </div>
    </>
  );
}