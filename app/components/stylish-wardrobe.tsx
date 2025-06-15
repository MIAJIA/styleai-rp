"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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

const STORAGE_KEY = "styleai_wardrobe";

// --- Define Default Photos ---
const DEFAULT_PHOTOS: Wardrobe = {
  tops: [
    { id: "default-top-1", imageSrc: "/cloth/green-top.png" },
    { id: "default-top-2", imageSrc: "/cloth/yellow-shirt.png" },
  ],
  bottoms: [
    { id: "default-bottom-1", imageSrc: "/cloth/jean.png" },
    { id: "default-bottom-2", imageSrc: "/cloth/LEIVs-jean-short.png" },
  ],
  dresses: [
    { id: "default-dress-1", imageSrc: "/cloth/blue-dress.png" },
    { id: "default-dress-2", imageSrc: "/cloth/yellow-dress.png" },
  ],
  outerwear: [
    { id: "default-outerwear-1", imageSrc: "/cloth/whiteblazer.png" },
    { id: "default-outerwear-2", imageSrc: "/cloth/黑皮衣.png" },
  ],
};

const INITIAL_WARDROBE: Wardrobe = {
  tops: [],
  bottoms: [],
  dresses: [],
  outerwear: [],
};

export default function MyWardrobe({ onGarmentSelect }: MyWardrobeProps) {
  const [wardrobe, setWardrobe] = useState<Wardrobe>(INITIAL_WARDROBE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentCategoryRef = useRef<WardrobeCategory | null>(null);

  // Effect to load from localStorage on mount
  useEffect(() => {
    try {
      const storedItem = window.localStorage.getItem(STORAGE_KEY);
      if (storedItem) {
        setWardrobe(JSON.parse(storedItem));
      }
    } catch (error) {
      console.error("Failed to parse wardrobe from localStorage", error);
    }
  }, []);

  // Effect to persist wardrobe changes to localStorage
  useEffect(() => {
    // Only save if the wardrobe is not the initial empty state.
    if (JSON.stringify(wardrobe) !== JSON.stringify(INITIAL_WARDROBE)) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobe));
      } catch (error) {
        console.error("Failed to save wardrobe to localStorage", error);
      }
    }
  }, [wardrobe]);

  // --- Start: New validation AND RESIZING logic ---

  const processAndResizeImage = async (file: File): Promise<string | null> => {
    // 1. Validate file type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file format. Please upload a JPG or PNG image.");
      return null;
    }

    // 2. Validate file size (max 10MB) - this is for the RAW upload
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      alert("File is too large. Please upload an image smaller than 10MB.");
      return null;
    }

    // 3. Resize the image to a thumbnail and validate original dimensions
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (img.width < 300 || img.height < 300) {
          alert(
            "Image dimensions are too small. Please use an image that is at least 300x300 pixels.",
          );
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        // Create canvas for resizing
        const canvas = document.createElement("canvas");
        const MAX_DIMENSION = 1024; // Increased from 512 to 1024 for higher quality
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          alert("Could not get canvas context for resizing.");
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Get the resized image as a JPEG Data URL (more efficient for photos)
        const resizedImageSrc = canvas.toDataURL("image/jpeg", 0.85); // Use JPEG with 85% quality
        URL.revokeObjectURL(objectUrl);
        resolve(resizedImageSrc);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        alert("Could not read image file. It might be corrupted.");
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
        setWardrobe((prev) => {
          // Filter out default items before adding the new one
          const userItems = prev[category].filter((item) => !item.id.startsWith("default-"));
          return {
            ...prev,
            [category]: [newItem, ...userItems],
          };
        });
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

  const handleDeleteItem = (category: WardrobeCategory, itemId: string) => {
    // Add a confirmation dialog to prevent accidental deletion
    if (window.confirm("Are you sure you want to delete this item?")) {
      setWardrobe((prev) => {
        const updatedItems = prev[category].filter((item) => item.id !== itemId);
        return {
          ...prev,
          [category]: updatedItems,
        };
      });
    }
  };

  // This is a simplified render function for one category.
  // We will build this out with proper styling.
  const renderCategory = (
    category: WardrobeCategory,
    name: string,
    emoji: string,
    colorClass: string,
  ) => {
    const userItems = wardrobe[category];
    const defaultItems = DEFAULT_PHOTOS[category];
    const itemsToDisplay = [
      ...userItems,
      ...defaultItems.filter(
        (dItem) => !userItems.some((uItem) => uItem.imageSrc === dItem.imageSrc),
      ),
    ];

    return (
      <div className={`${colorClass} rounded-3xl p-4 shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-lg">{emoji}</span>
            </div>
            <span className="font-playfair text-base font-bold text-white">{name}</span>
          </div>
          <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs font-sans font-medium text-white">
            {itemsToDisplay.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {/* Add Button */}
          <div
            onClick={() => handleAddClick(category)}
            className="aspect-square bg-white/30 rounded-xl shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center mb-1">
              <span className="text-xl text-white">+</span>
            </div>
            <p className="text-xs text-white font-medium">Add</p>
          </div>
          {/* Item List */}
          {itemsToDisplay.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onGarmentSelect(item.imageSrc)}
              className="relative group aspect-square bg-white rounded-xl shadow-sm cursor-pointer overflow-hidden"
            >
              <img
                src={item.imageSrc}
                alt="wardrobe item"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent the main card's click event
                  handleDeleteItem(category, item.id);
                }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-red-500"
                aria-label="Delete item"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* Container to ensure vertical stacking */}
      <div className="flex flex-col gap-y-4">
        {renderCategory("tops", "Tops", "👕", "bg-pink-200")}
        {renderCategory("bottoms", "Bottoms", "👖", "bg-blue-200")}
        {renderCategory("dresses", "Dresses", "👗", "bg-purple-200")}
        {renderCategory("outerwear", "Outerwear", "🧥", "bg-yellow-200")}
      </div>
    </div>
  );
}
