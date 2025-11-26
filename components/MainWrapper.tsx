"use client";

import { usePathname } from "next/navigation";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGeminiRoute = pathname?.startsWith("/gemini") ?? false;

  return (
    <main className={isGeminiRoute ? "h-full pb-safe" : "h-full pb-safe max-w-4xl mx-auto"}>
      {children}
    </main>
  );
}

