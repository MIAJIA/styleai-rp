import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "StyleAI - AI Fashion Try-On",
  description: "Visualize yourself in stunning outfits with AI-powered virtual try-on",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StyleAI",
  },
  generator: 'v0.dev'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full bg-neutral-50 overflow-x-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <main className="h-full pb-safe">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
