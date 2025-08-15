import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

// Load Inter font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Load Playfair Display font
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StyleMe - AI Fashion Stylist",
  description: "Create your perfect look with our AI Fashion Stylist and Peronal Shopper",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StyleMe",
  },
  generator: "v0.dev",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-x-hidden" suppressHydrationWarning data-atm-ext-installed="1.29.10">
      <SessionProviderWrapper>
        <main className="h-full pb-safe">{children}</main>
      </SessionProviderWrapper>
      </body>
    </html>
  );
}
