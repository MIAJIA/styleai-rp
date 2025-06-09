"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Look {
  id: number
  imageSrc: string
  title: string
}

const SAMPLE_LOOKS: Look[] = [
  {
    id: 1,
    imageSrc: "/fashion-model-outfit.png?height=300&width=200&query=fashion model outfit 1",
    title: "Summer Casual",
  },
  {
    id: 2,
    imageSrc: "/fashion-model-outfit.png?height=300&width=200&query=fashion model outfit 2",
    title: "Office Chic",
  },
  {
    id: 3,
    imageSrc: "/fashion-model-outfit.png?height=300&width=200&query=fashion model outfit 3",
    title: "Evening Glam",
  },
  {
    id: 4,
    imageSrc: "/fashion-model-outfit.png?height=300&width=200&query=fashion model outfit 4",
    title: "Weekend Style",
  },
]

export default function LookCarousel() {
  const [looks] = useState<Look[]>(SAMPLE_LOOKS)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScrollability = () => {
    if (!scrollRef.current) return

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    checkScrollability()
    window.addEventListener("resize", checkScrollability)
    return () => window.removeEventListener("resize", checkScrollability)
  }, [])

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return

    const scrollAmount = 200
    const newScrollLeft =
      direction === "left" ? scrollRef.current.scrollLeft - scrollAmount : scrollRef.current.scrollLeft + scrollAmount

    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    })

    setTimeout(checkScrollability, 300)
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-playfair text-xl font-bold text-neutral-900">Previous Looks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar" onScroll={checkScrollability}>
        {looks.map((look) => (
          <div key={look.id} className="flex-shrink-0 w-[160px] rounded-3xl overflow-hidden shadow-lg bg-white">
            <div className="aspect-[3/4] relative">
              <img src={look.imageSrc || "/placeholder.svg"} alt={look.title} className="w-full h-full object-cover" />
            </div>
            <div className="p-3">
              <h3 className="font-playfair text-sm font-bold text-neutral-800">{look.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
