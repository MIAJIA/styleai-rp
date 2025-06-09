"use client"

import { useState, useEffect } from "react"
import { Sparkles, Shirt, Heart, Star, Camera, Palette, Wand2, PenTool, MapPin, Eye } from "lucide-react"

interface GenerationAnimationProps {
  isVisible: boolean
  onComplete?: () => void
}

interface StylerCard {
  id: string
  heading: string
  advice: string
  signature: string
  icon: any
  delay: number
}

export default function GenerationAnimation({ isVisible, onComplete }: GenerationAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [visibleCards, setVisibleCards] = useState<string[]>([])

  const steps = [
    { text: "Analyzing your photo...", subText: "Understanding your style", icon: Camera, duration: 2000 },
    { text: "Processing garment details...", subText: "Identifying fabric and fit", icon: Shirt, duration: 2500 },
    { text: "AI magic in progress...", subText: "Creating your perfect look", icon: Wand2, duration: 3000 },
    { text: "Adding style touches...", subText: "Perfecting the details", icon: Palette, duration: 2000 },
    { text: "Almost ready...", subText: "Finalizing your transformation", icon: Sparkles, duration: 1500 },
  ]

  // Generate personalized stylist cards based on the current step
  const getStylerCards = (): StylerCard[] => {
    const cardSets = [
      // Early stage cards
      [
        {
          id: "color-insight",
          heading: "Color Insight",
          advice: "The warm undertones in your complexion will beautifully complement earth tones and jewel colors.",
          signature: "— Your AI Stylist ✨",
          icon: Palette,
          delay: 0,
        },
        {
          id: "stylist-note",
          heading: "Stylist Note",
          advice:
            "Your natural proportions suggest structured silhouettes will enhance your best features effortlessly.",
          signature: "— Fashion Expert",
          icon: PenTool,
          delay: 800,
        },
      ],
      // Mid stage cards
      [
        {
          id: "where-to-wear",
          heading: "Where to Wear",
          advice:
            "This look transitions perfectly from brunch meetings to evening social events with minimal adjustments.",
          signature: "— Style Consultant ✨",
          icon: MapPin,
          delay: 0,
        },
        {
          id: "styling-tip",
          heading: "Styling Tip",
          advice:
            "Consider adding a statement accessory to elevate the overall composition and create visual interest.",
          signature: "— Your Stylist",
          icon: Eye,
          delay: 1000,
        },
      ],
      // Final stage cards
      [
        {
          id: "final-touch",
          heading: "Final Touch",
          advice:
            "The proportions we've selected will create a harmonious silhouette that flatters your unique body type.",
          signature: "— AI Fashion Expert ✨",
          icon: Sparkles,
          delay: 0,
        },
        {
          id: "confidence-note",
          heading: "Confidence Note",
          advice:
            "This curated look reflects your personal style while introducing fresh elements to expand your wardrobe.",
          signature: "— Your Style Guide",
          icon: Heart,
          delay: 600,
        },
      ],
    ]

    if (currentStep < 2) return cardSets[0]
    if (currentStep < 4) return cardSets[1]
    return cardSets[2]
  }

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0)
      setProgress(0)
      setVisibleCards([])
      return
    }

    let stepTimer: NodeJS.Timeout
    let progressTimer: NodeJS.Timeout

    const runStep = (stepIndex: number) => {
      if (stepIndex >= steps.length) {
        setTimeout(() => {
          onComplete?.()
        }, 500)
        return
      }

      setCurrentStep(stepIndex)
      const stepDuration = steps[stepIndex].duration
      const progressIncrement = (100 / stepDuration) * 50

      let currentProgress = (stepIndex / steps.length) * 100
      setProgress(currentProgress)

      // Show cards with staggered animation
      const cards = getStylerCards()
      setVisibleCards([])
      cards.forEach((card, index) => {
        setTimeout(() => {
          setVisibleCards((prev) => [...prev, card.id])
        }, card.delay)
      })

      progressTimer = setInterval(() => {
        currentProgress += progressIncrement
        const maxProgress = ((stepIndex + 1) / steps.length) * 100
        if (currentProgress >= maxProgress) {
          currentProgress = maxProgress
          clearInterval(progressTimer)
        }
        setProgress(Math.min(currentProgress, 100))
      }, 50)

      stepTimer = setTimeout(() => {
        clearInterval(progressTimer)
        runStep(stepIndex + 1)
      }, stepDuration)
    }

    runStep(0)

    return () => {
      clearTimeout(stepTimer)
      clearInterval(progressTimer)
    }
  }, [isVisible, onComplete])

  useEffect(() => {
    // Update visible cards when step changes
    const cards = getStylerCards()
    setVisibleCards([])
    cards.forEach((card, index) => {
      setTimeout(() => {
        setVisibleCards((prev) => [...prev, card.id])
      }, card.delay)
    })
  }, [currentStep])

  if (!isVisible) return null

  const CurrentIcon = steps[currentStep]?.icon || Camera
  const stylerCards = getStylerCards()

  return (
    <div className="fixed inset-0 z-50 bg-[#fff9f4] flex items-center justify-center overflow-hidden">
      {/* Matching gradient background elements from homepage */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#D5F500] rounded-full opacity-60 blur-2xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FF6EC7] rounded-full opacity-60 blur-2xl translate-y-1/2 -translate-x-1/2 animate-pulse"></div>
      <div className="absolute top-1/4 left-1/3 w-28 h-28 bg-[#00C2FF] rounded-full opacity-40 blur-2xl animate-bounce-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-[#FF9B3E] rounded-full opacity-50 blur-2xl animate-bounce-slow"></div>

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-1/6 w-16 h-16 bg-[#FF6EC7] rounded-full opacity-30 blur-xl animate-float"></div>
      <div className="absolute top-3/4 right-1/5 w-20 h-20 bg-[#D5F500] rounded-full opacity-25 blur-xl animate-float-delayed"></div>

      {/* Floating fashion icons matching homepage style */}
      <div className="absolute inset-0">
        {[Shirt, Heart, Star, Sparkles, Palette].map((Icon, i) => (
          <Icon
            key={i}
            className="absolute text-gray-300 animate-float"
            size={24}
            style={{
              left: `${15 + i * 18}%`,
              top: `${25 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${4 + i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-8 max-w-2xl">
        {/* Central icon with matching design */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#FF6EC7] to-[#D5F500] rounded-full flex items-center justify-center shadow-2xl animate-pulse-slow">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
              <CurrentIcon className="text-[#FF6EC7]" size={32} />
            </div>
          </div>

          {/* Pulsing rings matching homepage blur style */}
          <div className="absolute inset-0 w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-[#FF6EC7]/30 rounded-full animate-ping-slow" />
            <div className="absolute inset-3 border-2 border-[#00C2FF]/40 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Step text with matching typography */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-playfair animate-fade-in">Creating Your Look</h1>
          <h2 className="text-lg font-semibold text-[#FF6EC7] mb-1 animate-fade-in-delayed">
            {steps[currentStep]?.text || "Preparing..."}
          </h2>
          <p className="text-gray-600 animate-fade-in-delayed-2">{steps[currentStep]?.subText || "Getting ready..."}</p>
        </div>

        {/* Progress bar matching homepage button style */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#FF6EC7] via-[#00C2FF] to-[#D5F500] rounded-full transition-all duration-500 ease-out relative shadow-lg"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-shimmer-slow" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-gray-500 text-sm font-medium">{Math.round(progress)}% Complete</p>
            <div className="flex space-x-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i <= currentStep ? "bg-[#FF6EC7]" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stylist Cards - Editorial Layout */}
        <div className="space-y-4 max-w-lg mx-auto">
          {stylerCards.map((card) => {
            const IconComponent = card.icon
            const isVisible = visibleCards.includes(card.id)

            return (
              <div
                key={card.id}
                className={`bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/40 transition-all duration-700 transform ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FF6EC7]/20 to-[#D5F500]/20 rounded-full flex items-center justify-center">
                      <IconComponent className="text-[#FF6EC7]" size={20} />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-serif font-semibold text-gray-800 mb-2 font-playfair">
                      {card.heading}
                    </h3>
                    <p className="text-gray-700 leading-relaxed mb-3 text-sm">{card.advice}</p>
                    <p className="text-xs text-gray-500 font-serif italic font-playfair">{card.signature}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subtle overlay animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer-overlay" />
    </div>
  )
}
