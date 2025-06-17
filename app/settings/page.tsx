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
      {/* 顶部标题栏 */}
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
          <h1 className="font-playfair text-lg font-bold text-gray-800">设置</h1>
          <div className="w-9" /> {/* 占位符，保持标题居中 */}
        </div>
      </header>

      {/* 设置内容 */}
      <div className="flex-1 px-4 py-6 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 数据迁移工具 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">数据管理</h2>
            <MigrationTool />
          </section>

          {/* 其他设置选项可以在这里添加 */}
          {/*
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">账户设置</h2>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600">账户功能开发中...</p>
            </div>
          </section>
          */}
        </div>
      </div>

      {/* 底部导航栏 */}
      <IOSTabBar />
    </div>
  );
}