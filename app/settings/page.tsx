"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import MigrationTool from "@/components/migration-tool";
import IOSTabBar from "../components/ios-tab-bar";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
      {/* Top Title Bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-playfair text-lg font-bold text-gray-800">Settings</h1>
          <div className="w-9" /> {/* Placeholder to keep title centered */}
        </div>
      </header>

      {/* Settings Content */}
      <div className="flex-1 px-4 py-6 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Data Migration Tool */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Data Management</h2>
            <MigrationTool />
          </section>

          {/* Other settings options can be added here */}
          {/*
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Account Settings</h2>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600">Account features are under development...</p>
            </div>
          </section>
          */}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <IOSTabBar />
    </div>
  );
}