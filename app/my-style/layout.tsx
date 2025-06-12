import type React from "react"
import IOSTabBar from "@/app/components/ios-tab-bar"

export default function MyStyleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen relative">
      {children}
      <IOSTabBar />
    </div>
  )
}
