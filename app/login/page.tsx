"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 如果用户已经登录，重定向到主页
  useEffect(() => {
    console.log("Login page - Status:", status);
    console.log("Login page - Session:", session);
    
    if (status === "authenticated" && session) {
      console.log("User authenticated, redirecting to /");
      router.push("/");
    }
  }, [session, status, router]);

  // 如果正在加载，显示加载状态
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 如果已经登录，不显示登录页面
  if (status === "authenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在跳转...</p>
        </div>
      </div>
    );
  }

  const handleGitHubLogin = async () => {
    console.log("GitHub login button clicked");
    try {
      const result = await signIn("github", {
        callbackUrl: "/",
        redirect: false,
      });
      console.log("Sign in result:", result);
      
      if (result?.error) {
        console.error("Sign in error:", result.error);
        alert(`登录失败: ${result.error}`);
      } else if (result?.url) {
        console.log("Redirecting to:", result.url);
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("登录失败，请检查网络连接或联系管理员。");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          {/* Logo/Title */}
          <div className="mb-8">
            <h1 className="font-playfair text-3xl font-bold text-gray-800 mb-2">
              StyleMe
            </h1>
            <p className="text-gray-600">
              登录以访问您的个性化时尚助手
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-6">
            <Button
              onClick={handleGitHubLogin}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-3"
              size="lg"
            >
              <Github className="w-5 h-5" />
              使用 GitHub 登录
            </Button>

            <div className="text-xs text-gray-500">
              登录后即可访问所有功能，包括AI造型师、个人风格档案等
            </div>

          </div>

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              登录后您可以：
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                <span>与AI造型师对话</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>查看个人风格档案</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>保存和管理您的造型</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>访问账户设置和余额</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 