"use client"

import { useState } from "react"
import { ChevronDown, Briefcase, Heart, Palette, Baby } from "lucide-react"
import { cn } from "@/lib/utils"
import IOSTabBar from "@/app/components/ios-tab-bar"

const personas = [
  {
    id: 1,
    title: "都市轻熟职场女性",
    subtitle: "28岁 PM，追求通勤优雅感",
    icon: Briefcase,
    color: "from-blue-500 to-indigo-600",
    details: {
      bodyType: "H型",
      measurements: "166cm / 55kg",
      strengths: "腿长、头肩比好",
      keywords: "极简、通勤、冷调",
      scenarios: "上班、职场会议",
    },
  },
  {
    id: 2,
    title: "大学甜美风女孩",
    subtitle: "21岁学生，想要甜美可爱感",
    icon: Heart,
    color: "from-pink-500 to-rose-600",
    details: {
      bodyType: "A型",
      measurements: "155cm / 46kg",
      strengths: "腰细、笑容甜美",
      keywords: "韩系、减龄、花朵图案",
      scenarios: "约会、日常校园",
    },
  },
  {
    id: 3,
    title: "文艺独立自由职业者",
    subtitle: "32岁插画师，追求文艺不撞风格",
    icon: Palette,
    color: "from-emerald-500 to-teal-600",
    details: {
      bodyType: "X型",
      measurements: "170cm / 58kg",
      strengths: "肩颈线优美",
      keywords: "中性、复古、日杂感",
      scenarios: "咖啡馆、创作展览",
    },
  },
  {
    id: 4,
    title: "二胎宝妈产后恢复期",
    subtitle: "35岁妈妈，想要显瘦温柔日常感",
    icon: Baby,
    color: "from-amber-500 to-orange-600",
    details: {
      bodyType: "苹果型",
      measurements: "160cm / 63kg",
      strengths: "胸型好、气质温婉",
      keywords: "修饰身形、针织感、柔色系",
      scenarios: "日常接娃、家庭聚会",
    },
  },
]

export default function PersonaPage() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null)

  const toggleCard = (id: number) => {
    setExpandedCard(expandedCard === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-[#fff9f4] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#fff9f4]/80 backdrop-blur-lg border-b border-neutral-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-center" style={{ fontFamily: "Playfair Display" }}>
            Style Personas
          </h1>
          <p className="text-sm text-neutral-600 text-center mt-1">发现适合你的风格人设</p>
        </div>
      </div>

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-40 h-40 bg-gradient-to-br from-pink-300/20 to-rose-400/20 rounded-full blur-2xl" />
        <div className="absolute top-60 -left-16 w-32 h-32 bg-gradient-to-br from-blue-300/20 to-indigo-400/20 rounded-full blur-2xl" />
        <div className="absolute bottom-40 right-8 w-24 h-24 bg-gradient-to-br from-emerald-300/20 to-teal-400/20 rounded-full blur-xl" />
      </div>

      {/* Persona Cards */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {personas.map((persona) => {
          const isExpanded = expandedCard === persona.id
          const IconComponent = persona.icon

          return (
            <div
              key={persona.id}
              className={cn(
                "bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all duration-300 overflow-hidden",
                isExpanded ? "shadow-xl" : "hover:shadow-xl hover:-translate-y-1",
              )}
            >
              {/* Card Header */}
              <button
                onClick={() => toggleCard(persona.id)}
                className="w-full p-6 text-left focus:outline-none focus:ring-2 focus:ring-pink-300 rounded-2xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md",
                        persona.color,
                      )}
                    >
                      <IconComponent size={24} className="text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: "Playfair Display" }}>
                        {persona.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{persona.subtitle}</p>
                    </div>
                  </div>

                  {/* Toggle Icon */}
                  <ChevronDown
                    size={20}
                    className={cn(
                      "text-gray-400 transition-transform duration-300 mt-1",
                      isExpanded ? "rotate-180" : "",
                    )}
                  />
                </div>
              </button>

              {/* Expandable Content */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="px-6 pb-6 pt-2">
                  <div className="bg-gray-50/80 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">身形类型</span>
                        <span className="text-sm text-gray-900 font-semibold">{persona.details.bodyType}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">身高/体重</span>
                        <span className="text-sm text-gray-900">{persona.details.measurements}</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-700">优势</span>
                        <span className="text-sm text-gray-900 text-right flex-1 ml-4">
                          {persona.details.strengths}
                        </span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-700">风格关键词</span>
                        <span className="text-sm text-gray-900 text-right flex-1 ml-4">{persona.details.keywords}</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-700">场景</span>
                        <span className="text-sm text-gray-900 text-right flex-1 ml-4">
                          {persona.details.scenarios}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Spacing for Tab Bar */}
      <div className="h-8" />

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  )
}
