"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Info, GalleryVerticalEnd, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "StyleMe", icon: Home },
  { href: "/results", label: "My Looks", icon: GalleryVerticalEnd },
  { href: "/chat", label: "AI Stylist", icon: MessageCircle },
  { href: "/my-style", label: "My Style", icon: User },
];

export default function IOSTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const handleNavigation = (href: string) => {
    // 检查是否需要登录
    const requiresAuth = href !== "/";
    if (requiresAuth && !session) {
      alert("Please log in to access this feature.");
      router.push('/login');
      return;
    }
    router.push(href);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-neutral-200 z-50 pt-2 pb-safe">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const requiresAuth = item.href !== "/";

          return (
            <button
              key={item.href}
              onClick={() => handleNavigation(item.href)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-1 ios-btn",
                isActive ? "text-primary" : "text-neutral-400",
                requiresAuth && !session && "opacity-50"
              )}
            >
              <item.icon size={20} className={cn(isActive ? "text-primary" : "text-neutral-400")} />
              <span className={cn("text-xs mt-1", isActive ? "font-medium" : "font-normal")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
