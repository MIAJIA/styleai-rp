"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, Info } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/result", icon: Camera, label: "Results" },
    { href: "/about", icon: Info, label: "About" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-rose-100 z-50">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200 ${
                isActive ? "text-rose-600 bg-rose-50" : "text-gray-500 hover:text-rose-500"
              }`}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
