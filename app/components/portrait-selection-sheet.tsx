"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";

// Props for the component
interface PortraitSelectionSheetProps {
  onPortraitSelect: (imageSrc: string, persona?: object) => void;
}

// Data structure for a single portrait
interface Portrait {
  id: string;
  imageSrc: string;
}

// --- Start: Persona Data ---
// This map will hold the detailed persona information for each example user.
// The key is the image path, and the value is the detailed style profile.
const examplePersonaMap = new Map<string, object>([
  [
    "/examples/example_wangdake_business.jpg",
    {
      user_id: "user001",
      body_profile: {
        shape_type: "H-shape",
        height_cm: 166,
        weight_kg: 55,
        proportions: {
          waist_position: "Normal",
          leg_length: "Long legs",
          shoulder_to_hip_ratio: "Standard",
        },
        strengths: ["Long legs", "Good head-to-shoulder ratio"],
        weaknesses: ["No defined waistline"],
      },
      face_profile: {
        face_shape: "Oval face",
        line_style: "Curvy",
        facial_strengths: ["Soft facial features"],
        facial_weaknesses: [],
      },
      color_texture: {
        skin_tone: "Cool-toned fair skin",
        fabric_preferences: ["Silk", "Wool"],
        pattern_preferences: ["Solid colors"],
      },
      natural_vibe: { personality: "Outgoing", natural_style: "Chic urban style" },
      style_goal: {
        target_vibe: "Elegant & professional",
        highlight_parts: ["Legs", "Collarbone"],
        hide_parts: ["Waistline"],
        scene: "Work",
        style_keywords: ["Minimalist", "Commuter", "Neutral colors"],
        style_constraints: ["Not too revealing"],
      },
    },
  ],
  [
    "/examples/example_lidake_girly.jpg",
    {
      user_id: "user002",
      body_profile: {
        shape_type: "A-shape",
        height_cm: 155,
        weight_kg: 46,
        proportions: {
          waist_position: "Normal",
          leg_length: "Short legs",
          shoulder_to_hip_ratio: "Narrow shoulders",
        },
        strengths: ["Large eyes", "Slim waist"],
        weaknesses: ["Short legs", "Short height"],
      },
      face_profile: {
        face_shape: "Round face",
        line_style: "Curvy",
        facial_strengths: ["Sweet smile"],
        facial_weaknesses: [],
      },
      color_texture: {
        skin_tone: "Warm-toned fair skin",
        fabric_preferences: ["Cotton", "Chiffon"],
        pattern_preferences: ["Floral", "Ditsy patterns"],
      },
      natural_vibe: { personality: "Introverted", natural_style: "Cute and girly" },
      style_goal: {
        target_vibe: "K-style sweet",
        highlight_parts: ["Face", "Upper body"],
        hide_parts: ["Legs"],
        scene: "Date",
        style_keywords: ["K-style", "Youthful", "Cute"],
        style_constraints: ["No high heels", "Not too mature"],
      },
    },
  ],
  [
    "/examples/example_liudazhuang_arty.jpg",
    {
      user_id: "user003",
      body_profile: {
        shape_type: "X-shape",
        height_cm: 170,
        weight_kg: 58,
        proportions: {
          waist_position: "Normal",
          leg_length: "Long legs",
          shoulder_to_hip_ratio: "Standard",
        },
        strengths: ["Tall", "Long legs"],
        weaknesses: ["Wide hips"],
      },
      face_profile: {
        face_shape: "Long face",
        line_style: "Straight",
        facial_strengths: ["High nose bridge", "Unique eye shape"],
        facial_weaknesses: ["Slightly high cheekbones"],
      },
      color_texture: {
        skin_tone: "Tan skin",
        fabric_preferences: ["Linen", "Cotton"],
        pattern_preferences: ["Geometric", "Patchwork"],
      },
      natural_vibe: { personality: "Androgynous", natural_style: "Artistic and cool" },
      style_goal: {
        target_vibe: "Independent with attitude",
        highlight_parts: ["Shoulder line"],
        hide_parts: ["Hips"],
        scene: "Exhibition/Cafe",
        style_keywords: ["Japanese magazine style", "Gender-neutral", "Vintage androgynous"],
        style_constraints: ["Dislikes tight clothing", "Dislikes high-saturation colors"],
      },
    },
  ],
]);
// --- End: Persona Data ---

// Pre-defined example photos to show if the user has none.
// These paths now match the renamed files and the keys in the persona map.
// const EXAMPLE_PHOTOS: Portrait[] = [
//   { id: "example-1", imageSrc: "/examples/example_liudazhuang_arty.jpg" },
//   { id: "example-2", imageSrc: "/examples/example_lidake_girly.jpg" },
//   { id: "example-3", imageSrc: "/examples/example_wangdake_business.jpg" },
// ];

// Using the real idol images now located in /public/idols
const DEFAULT_IDOLS: Portrait[] = [
  // { id: "idol-1", imageSrc: "/idols/idol_xiao_zhan.jpg" },
  // { id: "idol-2", imageSrc: "/idols/idol_peng_yuyan_fullbody.png" },
  // { id: "idol-3", imageSrc: "/idols/idol_liu_yifei_denim.jpg" },
  { id: "idol-1", imageSrc: "/idols/01_fair_average.png" },
  { id: "idol-2", imageSrc: "/idols/01_fair_slim.png" },
  { id: "idol-3", imageSrc: "/idols/03_fair_plus.png" },
  { id: "idol-4", imageSrc: "/idols/03_light_average.png" },
  { id: "idol-5", imageSrc: "/idols/04_light_average.png" },
  { id: "idol-6", imageSrc: "/idols/05_medium_average.png" },
  { id: "idol-7", imageSrc: "/idols/07_medium_chubby.png" },
  { id: "idol-8", imageSrc: "/idols/08_deep tan_slim.png" },
  { id: "idol-9", imageSrc: "/idols/09_deep tan_average.png" },
  { id: "idol-10", imageSrc: "/idols/10_deep tan_chubby.png" },
];

const MY_PHOTOS_STORAGE_KEY = "styleai_portraits";
const IDOLS_STORAGE_KEY = "styleai_idols";

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
    label: "Models",
  },
};

export default function PortraitSelectionSheet({ onPortraitSelect }: PortraitSelectionSheetProps) {
  const [myPhotos, setMyPhotos] = useState<Portrait[]>([]);
  const [idols, setIdols] = useState<Portrait[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<"myPhotos" | "idols" | null>(null);

  // Load photos from localStorage on mount
  useEffect(() => {
    try {
      const storedMyPhotos = window.localStorage.getItem(MY_PHOTOS_STORAGE_KEY);
      if (storedMyPhotos) setMyPhotos(JSON.parse(storedMyPhotos));

      const storedIdols = window.localStorage.getItem(IDOLS_STORAGE_KEY);
      if (storedIdols) setIdols(JSON.parse(storedIdols));
    } catch (error) {
      console.error("Failed to parse photos from localStorage", error);
    }
  }, []);

  // Save myPhotos to localStorage when they change
  useEffect(() => {
    if (myPhotos.length > 0 && !myPhotos.every((p) => p.id.startsWith("example-"))) {
      try {
        window.localStorage.setItem(MY_PHOTOS_STORAGE_KEY, JSON.stringify(myPhotos));
      } catch (error) {
        console.error("Failed to save my photos to localStorage", error);
      }
    }
  }, [myPhotos]);

  // Save idols to localStorage when they change
  useEffect(() => {
    if (idols.length > 0 && !idols.every((p) => p.id.startsWith("idol-"))) {
      try {
        window.localStorage.setItem(IDOLS_STORAGE_KEY, JSON.stringify(idols));
      } catch (error) {
        console.error("Failed to save idols to localStorage", error);
      }
    }
  }, [idols]);

  const processAndResizeImage = async (file: File): Promise<string | null> => {
    // This is the same battle-tested image resizing logic from the wardrobe
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Invalid file format. Please upload a JPG or PNG image.");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload an image smaller than 10MB.");
      return null;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        if (img.width < 300 || img.height < 300) {
          alert("Image dimensions too small. Please use an image at least 300x300 pixels.");
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        const MAX_DIMENSION = 1024;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(null);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activeCategory) {
      const imageSrc = await processAndResizeImage(file);
      if (imageSrc) {
        const newPortrait: Portrait = { id: `portrait-${Date.now()}`, imageSrc };
        if (activeCategory === "myPhotos") {
          setMyPhotos((prev) => [newPortrait, ...prev.filter((p) => !p.id.startsWith("example-"))]);
        } else if (activeCategory === "idols") {
          setIdols((prev) => [newPortrait, ...prev.filter((p) => !p.id.startsWith("idol-"))]);
        }
      }
    }
    if (event.target) event.target.value = "";
    setActiveCategory(null);
  };

  const handleDelete = (portraitId: string, category: "myPhotos" | "idols") => {
    const confirmation = window.confirm("Are you sure you want to delete this photo?");
    if (confirmation) {
      if (category === "myPhotos") {
        setMyPhotos((prev) => prev.filter((p) => p.id !== portraitId));
      } else {
        setIdols((prev) => prev.filter((p) => p.id !== portraitId));
      }
    }
  };

  const handleAddClick = (category: "myPhotos" | "idols") => {
    setActiveCategory(category);
    fileInputRef.current?.click();
  };

  const renderPhotoGrid = (photos: Portrait[], category: "myPhotos" | "idols") => (
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
            onClick={() => {
              const persona = examplePersonaMap.get(photo.imageSrc);
              onPortraitSelect(photo.imageSrc, persona);
            }}
            className="w-full h-full bg-white rounded-lg overflow-hidden"
          >
            <img
              src={photo.imageSrc}
              alt="Portrait"
              className={`w-full h-full ${category === "myPhotos" ? "object-cover" : "object-contain"} group-hover:scale-105 transition-transform`}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(photo.id, category);
            }}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-red-500"
            aria-label="Delete photo"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  // New function to render a styled category block, similar to the wardrobe
  const renderCategory = (type: "myPhotos" | "idols") => {
    const isIdol = type === "idols";
    const userPhotos = isIdol ? idols : myPhotos;
    const defaultPhotos = isIdol ? DEFAULT_IDOLS : [];

    // Fix: handle possible nulls and type issues for defaultPhotos
    const filteredDefaultPhotos = defaultPhotos
      .filter((ex): ex is Portrait => !!ex && typeof ex !== "string" && "imageSrc" in ex);

    const photosToDisplay = [
      ...userPhotos,
      ...filteredDefaultPhotos.filter(
        (ex) => !userPhotos.some((p) => p.imageSrc === ex.imageSrc)
      ),
    ];
    const { bg, emoji, label } = PORTRAIT_CATEGORY_STYLES[type];

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
    );
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Upload guidance section */}
      <div className="mb-4 p-3 bg-pink-50 rounded-2xl border border-pink-200">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs">📷</span>
          </div>
          <div className="text-xs space-y-1">
            <p className="font-medium text-pink-900">Photo Tips for Best Results:</p>
            <p className="text-pink-700">☑️ Full‑body photo of yourself standing facing the camera against a clean, uncluttered background.</p>
            <p className="text-red-600">✖️Avoid sitting、lying down or cropped photos</p>
          </div>
        </div>
      </div>
      

      {/* Container to ensure vertical stacking */}
      <div className="flex flex-col gap-y-4">
        {renderCategory("myPhotos")}
        {renderCategory("idols")}
      </div>
    </div>
  );
}
