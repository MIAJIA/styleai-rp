"use client";

import { Camera, Sparkles, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import IOSTabBar from "../components/ios-tab-bar";
import IOSHeader from "../components/ios-header";

export default function AboutPage() {
  const steps = [
    {
      icon: Camera,
      title: "Personal Color Analysis",
      description: "Personal color analyst helping you find your best colors",
      color: "bg-sky-100 text-sky-900",
    },
    {
      icon: Sparkles,
      title: "AI Stylist",
      description: "Our AI Stylist personalized looks just for you",
      color: "bg-violet-100 text-violet-900",
    },
    {
      icon: Share2,
      title: "Share & Save",
      description: "Save your favorites and share with friends",
      color: "bg-amber-100 text-amber-900",
    },
  ];

  const features = [
    "Personalized style recommendations",
    "Multiple fashion scenarios",
    "Realistic AI-generated outfits",
    "iOS-optimized experience",
    "Share directly to social media",
  ];

  return (
    <div className="min-h-full pb-20">
      <IOSHeader
        title="How It Works"
        subtitle="Discover the magic behind StyleAI"
        className="bg-white sticky top-0 z-10 border-b border-neutral-100"
      />

      {/* Hero section */}
      <div className="px-5 py-6 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-fade-in">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2 animate-fade-up">Your Personal AI Stylist</h2>
        <p
          className="text-sm text-neutral-600 max-w-xs mx-auto animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          StyleAI uses advanced AI to help you discover your perfect style
        </p>
      </div>

      {/* Steps */}
      <div className="px-5 space-y-4 mb-8">
        {steps.map((step, index) => (
          <div
            key={index}
            className="ios-card p-4 animate-fade-up"
            style={{ animationDelay: `${0.2 + index * 0.1}s` }}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${step.color}`}
              >
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium mb-1">{step.title}</h3>
                <p className="text-sm text-neutral-600">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="px-5 mb-8">
        <div className="ios-card p-5 animate-fade-up" style={{ animationDelay: "0.5s" }}>
          <h3 className="font-medium mb-4">Why Choose Ensemble?</h3>
          <ul className="space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sm text-neutral-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5">
        <div
          className="bg-primary rounded-2xl p-5 text-white text-center animate-fade-up"
          style={{ animationDelay: "0.6s" }}
        >
          <h3 className="font-medium mb-2">Ready to Transform Your Style?</h3>
          <p className="text-sm text-white/80 mb-4">
            Join thousands of fashion-forward users today
          </p>
          <Button className="bg-white text-primary hover:bg-white/90 w-full h-12 rounded-xl font-medium">
            Start Styling Now
          </Button>
        </div>
      </div>

      <IOSTabBar />
    </div>
  );
}
