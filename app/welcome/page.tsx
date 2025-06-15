"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("styleMe_onboarding_completed");

    if (hasCompletedOnboarding) {
      router.push("/");
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-pink-200 to-rose-300 rounded-full opacity-20 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-200 to-pink-300 rounded-full opacity-20 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
      <div className="absolute top-1/3 left-1/4 w-24 h-24 bg-gradient-to-br from-rose-200 to-pink-200 rounded-full opacity-15 blur-2xl"></div>
      <div className="absolute bottom-1/4 right-1/3 w-20 h-20 bg-gradient-to-tr from-pink-300 to-rose-200 rounded-full opacity-15 blur-2xl"></div>

      {/* Main content */}
      <div
        className={`text-center space-y-8 max-w-sm mx-auto transition-all duration-1000 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* App Icon/Logo */}
        <div
          className={`transition-all duration-1000 delay-200 ease-out ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 rounded-3xl shadow-2xl flex items-center justify-center mb-8">
            <span className="text-4xl">✨</span>
          </div>
        </div>

        {/* Main heading */}
        <div
          className={`space-y-4 transition-all duration-1000 delay-300 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-4xl font-bold text-gray-800 leading-tight">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 bg-clip-text text-transparent">
              StyleMe
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg text-gray-600 leading-relaxed px-4">
            Your personal AI stylist is here to help you look your best.
          </p>
        </div>

        {/* Feature highlights */}
        <div
          className={`space-y-4 transition-all duration-1000 delay-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-rose-400 rounded-full"></div>
              <span>Personalized</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
              <span>Instant</span>
            </div>
          </div>
        </div>

        {/* Call-to-action button */}
        <div
          className={`pt-4 transition-all duration-1000 delay-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <Button
            onClick={handleGetStarted}
            className="w-full h-14 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:via-rose-600 hover:to-pink-700 text-white rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="flex items-center justify-center space-x-2">
              <span>✨</span>
              <span>Get Started</span>
            </span>
          </Button>
        </div>

        {/* Bottom decorative text */}
        <div
          className={`pt-8 transition-all duration-1000 delay-900 ease-out ${isVisible ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            DISCOVER YOUR PERFECT STYLE
          </p>
        </div>
      </div>

      {/* Floating elements for visual interest */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute top-1/4 right-8 transition-all duration-2000 delay-1000 ease-out ${
            isVisible ? "opacity-30 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="w-3 h-3 bg-pink-300 rounded-full animate-pulse"></div>
        </div>
        <div
          className={`absolute bottom-1/3 left-8 transition-all duration-2000 delay-1200 ease-out ${
            isVisible ? "opacity-20 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className="w-2 h-2 bg-rose-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.5s" }}
          ></div>
        </div>
        <div
          className={`absolute top-1/2 right-1/4 transition-all duration-2000 delay-1400 ease-out ${
            isVisible ? "opacity-25 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
