"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Shirt, Heart, Star, Camera, Palette, Wand2, PenTool, MapPin, Eye } from "lucide-react"

interface GenerationAnimationProps {
  isVisible: boolean
  isComplete?: boolean
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

export default function GenerationAnimation({ isVisible, isComplete, onComplete }: GenerationAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [visibleCards, setVisibleCards] = useState<string[]>([])
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const steps = [
    { text: "Analyzing your photo...", subText: "Understanding your style", icon: Camera, duration: 2000 },
    { text: "Processing garment details...", subText: "Identifying fabric and fit", icon: Shirt, duration: 2500 },
    { text: "AI magic in progress...", subText: "Creating your perfect look", icon: Wand2, duration: 3000 },
    { text: "Adding style touches...", subText: "Perfecting the details", icon: Palette, duration: 2000 },
    { text: "Almost ready...", subText: "Finalizing your transformation", icon: Sparkles, duration: 4000 },
  ]

  // Generate personalized stylist cards based on the current step
  const getStylerCards = (): StylerCard[] => {
    const cardSets = [
      // Early stage cards
      [
        {
          id: "color-insight",
          heading: "Color Insight",
          advice: "Warm undertones will complement earth tones beautifully.",
          signature: "— Your AI Stylist ✨",
          icon: Palette,
          delay: 0,
        },
        {
          id: "stylist-note",
          heading: "Stylist Note",
          advice: "Structured silhouettes will enhance your best features.",
          signature: "— Fashion Expert",
          icon: PenTool,
          delay: 600,
        },
      ],
      // Mid stage cards
      [
        {
          id: "where-to-wear",
          heading: "Where to Wear",
          advice: "Perfect for brunch meetings to evening social events.",
          signature: "— Style Consultant ✨",
          icon: MapPin,
          delay: 0,
        },
        {
          id: "styling-tip",
          heading: "Styling Tip",
          advice: "A statement accessory will elevate the composition.",
          signature: "— Your Stylist",
          icon: Eye,
          delay: 600,
        },
      ],
      // Final stage cards
      [
        {
          id: "final-touch",
          heading: "Final Touch",
          advice: "These proportions create a harmonious silhouette.",
          signature: "— AI Fashion Expert ✨",
          icon: Sparkles,
          delay: 0,
        },
        {
          id: "confidence-note",
          heading: "Confidence Note",
          advice: "This look reflects your style with fresh elements.",
          signature: "— Your Style Guide",
          icon: Heart,
          delay: 500,
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
        // Loop the last step to keep the animation alive until isComplete is true
        const lastStepIndex = steps.length - 1
        setCurrentStep(lastStepIndex)
        setProgress(99) // Hold at 99%
        return
      }

      setCurrentStep(stepIndex)
      const stepDuration = steps[stepIndex].duration
      const progressIncrement = (100 / stepDuration) * 50

      let currentProgress = (stepIndex / steps.length) * 100
      setProgress(Math.min(currentProgress, 99)) // Cap progress at 99 before completion

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
        setProgress(Math.min(currentProgress, 99)) // Cap progress at 99 before completion
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
  }, [isVisible])

  useEffect(() => {
    if (isComplete) {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)

      setProgress(100)

      setTimeout(() => {
        onComplete?.()
      }, 500) // Wait 500ms after hitting 100% to navigate
    }
  }, [isComplete, onComplete])

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
    <div className="fixed inset-0 z-50 bg-[#fff9f4] flex items-center justify-center overflow-hidden py-12 px-4">
      {/* Optimized gradient background elements for mobile */}
      <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-[#D5F500] rounded-full opacity-50 sm:opacity-60 blur-xl sm:blur-2xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#FF6EC7] rounded-full opacity-50 sm:opacity-60 blur-xl sm:blur-2xl translate-y-1/2 -translate-x-1/2 animate-pulse"></div>
      <div className="absolute top-1/4 left-1/3 w-20 h-20 sm:w-28 sm:h-28 bg-[#00C2FF] rounded-full opacity-30 sm:opacity-40 blur-xl sm:blur-2xl animate-bounce-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-16 h-16 sm:w-24 sm:h-24 bg-[#FF9B3E] rounded-full opacity-40 sm:opacity-50 blur-xl sm:blur-2xl animate-bounce-slow"></div>

      {/* Reduced floating elements for mobile */}
      <div className="absolute inset-0 hidden sm:block">
        {[Shirt, Heart, Star].map((Icon, i) => (
          <Icon
            key={i}
            className="absolute text-gray-300 animate-float"
            size={20}
            style={{
              left: `${20 + i * 25}%`,
              top: `${30 + (i % 2) * 30}%`,
              animationDelay: `${i * 1}s`,
              animationDuration: `${4 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Main content - Mobile optimized */}
      <div className="relative z-10 text-center px-4 sm:px-8 w-full max-w-sm sm:max-w-lg h-full flex flex-col justify-center">
        {/* Compact central icon */}
        <div className="mb-4 sm:mb-6 relative flex-shrink-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-[#FF6EC7] to-[#D5F500] rounded-full flex items-center justify-center shadow-xl animate-pulse-slow">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center">
              <CurrentIcon className="text-[#FF6EC7]" size={20} />
            </div>
          </div>

          {/* Simplified pulsing rings */}
          <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <div className="absolute inset-0 border-2 sm:border-3 border-[#FF6EC7]/30 rounded-full animate-ping-slow" />
            <div className="absolute inset-2 border border-[#00C2FF]/40 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Compact step text */}
        {/* Refined heading section */}
        <div className="mb-4 sm:mb-6 flex-shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3 font-playfair animate-fade-in">
            Your AI Stylist is crafting a look just for you ✨
          </h1>
          <div className="flex items-center justify-center space-x-2 animate-fade-in-delayed">
            <div className="w-1 h-1 bg-[#FF6EC7] rounded-full animate-pulse"></div>
            <p className="text-sm sm:text-base text-gray-600 font-medium">
              {currentStep < 2 && "Analyzing your unique style"}
              {currentStep >= 2 && currentStep < 4 && "Curating the perfect combination"}
              {currentStep >= 4 && "Adding the finishing touches"}
            </p>
            <div className="w-1 h-1 bg-[#FF6EC7] rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Compact progress bar */}
        <div className="mb-4 sm:mb-6 flex-shrink-0">
          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#FF6EC7] via-[#00C2FF] to-[#D5F500] rounded-full transition-all duration-500 ease-out relative shadow-lg"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-shimmer-slow" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-1 sm:mt-2">
            <p className="text-gray-500 text-xs sm:text-sm font-medium">{Math.round(progress)}%</p>
            <div className="flex space-x-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${i <= currentStep ? "bg-[#FF6EC7]" : "bg-gray-300"
                    }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-optimized stylist cards */}
        <div className="space-y-2 sm:space-y-3 flex-1 min-h-0 overflow-hidden">
          {stylerCards.map((card) => {
            const IconComponent = card.icon
            const isVisible = visibleCards.includes(card.id)

            return (
              <div
                key={card.id}
                className={`bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg border border-white/40 transition-all duration-700 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#FF6EC7]/20 to-[#D5F500]/20 rounded-full flex items-center justify-center">
                      <IconComponent className="text-[#FF6EC7]" size={16} />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-sm sm:text-base font-serif font-semibold text-gray-800 mb-1 font-playfair">
                      {card.heading}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-1 sm:mb-2">{card.advice}</p>
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
