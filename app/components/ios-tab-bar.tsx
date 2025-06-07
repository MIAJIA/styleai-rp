"use client"

import { usePathname, useRouter } from "next/navigation"
import { Home, Camera, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export default function IOSTabBar() {
  const pathname = usePathname()
  const router = useRouter()

  const tabs = [
    {
      name: "Home",
      href: "/",
      icon: Home,
    },
    {
      name: "Results",
      href: "/results",
      icon: Camera,
    },
    {
      name: "About",
      href: "/about",
      icon: Info,
    },
  ]

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-neutral-200 z-50 pt-2 pb-safe">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-1 ios-btn",
                isActive ? "text-primary" : "text-neutral-400",
              )}
            >
              <tab.icon size={22} className={cn(isActive ? "text-primary" : "text-neutral-400")} />
              <span className={cn("text-xs mt-1", isActive ? "font-medium" : "font-normal")}>{tab.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
