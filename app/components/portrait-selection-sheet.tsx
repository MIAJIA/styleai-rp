"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Plus, X } from "lucide-react"

// Props for the component
interface PortraitSelectionSheetProps {
  onPortraitSelect: (imageSrc: string, persona?: object) => void
}

// Data structure for a single portrait
interface Portrait {
  id: string
  imageSrc: string
}

// --- Start: Persona Data ---
// This map will hold the detailed persona information for each example user.
// The key is the image path, and the value is the detailed style profile.
const examplePersonaMap = new Map<string, object>([
  [
    '/examples/example_王大可_职场.jpg',
    {
      "user_id": "user001",
      "body_profile": {
        "shape_type": "H型",
        "height_cm": 166,
        "weight_kg": 55,
        "proportions": { "waist_position": "正常", "leg_length": "腿长", "shoulder_to_hip_ratio": "标准" },
        "strengths": ["腿长", "头肩比好"],
        "weaknesses": ["无明显腰线"]
      },
      "face_profile": {
        "face_shape": "瓜子脸",
        "line_style": "曲线感",
        "facial_strengths": ["五官柔和"],
        "facial_weaknesses": []
      },
      "color_texture": {
        "skin_tone": "冷白",
        "fabric_preferences": ["真丝", "羊毛"],
        "pattern_preferences": ["素色"]
      },
      "natural_vibe": { "personality": "外向", "natural_style": "干练都市感" },
      "style_goal": {
        "target_vibe": "优雅精英",
        "highlight_parts": ["腿部", "锁骨"],
        "hide_parts": ["腰线"],
        "scene": "上班",
        "style_keywords": ["极简", "通勤", "中性色"],
        "style_constraints": ["不能太暴露"]
      }
    }
  ],
  [
    '/examples/example_李大可_少女.jpg',
    {
      "user_id": "user002",
      "body_profile": {
        "shape_type": "A型",
        "height_cm": 155,
        "weight_kg": 46,
        "proportions": { "waist_position": "正常", "leg_length": "腿短", "shoulder_to_hip_ratio": "窄肩" },
        "strengths": ["眼睛大", "腰细"],
        "weaknesses": ["腿短", "身高矮"]
      },
      "face_profile": {
        "face_shape": "圆脸",
        "line_style": "曲线感",
        "facial_strengths": ["笑容甜美"],
        "facial_weaknesses": []
      },
      "color_texture": {
        "skin_tone": "暖白",
        "fabric_preferences": ["棉", "雪纺"],
        "pattern_preferences": ["花朵", "碎图案"]
      },
      "natural_vibe": { "personality": "内向", "natural_style": "可爱少女系" },
      "style_goal": {
        "target_vibe": "韩系甜美",
        "highlight_parts": ["脸部", "上半身"],
        "hide_parts": ["腿部"],
        "scene": "约会",
        "style_keywords": ["韩系", "减龄", "可爱"],
        "style_constraints": ["不穿高跟", "不能太成熟"]
      }
    }
  ],
  [
    '/examples/example_刘大壮_文艺.jpg',
    {
      "user_id": "user003",
      "body_profile": {
        "shape_type": "X型",
        "height_cm": 170,
        "weight_kg": 58,
        "proportions": { "waist_position": "正常", "leg_length": "腿长", "shoulder_to_hip_ratio": "标准" },
        "strengths": ["身高好", "腿长"],
        "weaknesses": ["胯宽"]
      },
      "face_profile": {
        "face_shape": "长脸",
        "line_style": "直线感",
        "facial_strengths": ["鼻梁高", "眼型特别"],
        "facial_weaknesses": ["颧骨略高"]
      },
      "color_texture": {
        "skin_tone": "小麦色",
        "fabric_preferences": ["麻", "棉"],
        "pattern_preferences": ["几何", "拼接"]
      },
      "natural_vibe": { "personality": "中性", "natural_style": "文艺冷感" },
      "style_goal": {
        "target_vibe": "独立有态度",
        "highlight_parts": ["肩部线条"],
        "hide_parts": ["胯部"],
        "scene": "展览/咖啡馆",
        "style_keywords": ["日杂", "无性别风", "复古中性"],
        "style_constraints": ["不喜欢紧身", "不喜欢高饱和色"]
      }
    }
  ]
]);
// --- End: Persona Data ---

// Pre-defined example photos to show if the user has none.
// These paths now match the renamed files and the keys in the persona map.
const EXAMPLE_PHOTOS: Portrait[] = [
  { id: "example-1", imageSrc: "/examples/example_刘大壮_文艺.jpg" },
  { id: "example-2", imageSrc: "/examples/example_李大可_少女.jpg" },
  { id: "example-3", imageSrc: "/examples/example_王大可_职场.jpg" },
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
            onClick={() => {
              const persona = examplePersonaMap.get(photo.imageSrc);
              onPortraitSelect(photo.imageSrc, persona);
            }}
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
