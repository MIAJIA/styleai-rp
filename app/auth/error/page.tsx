"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "服务器配置错误，请联系管理员。";
      case "AccessDenied":
        return "访问被拒绝，请检查您的权限。";
      case "Verification":
        return "验证失败，请重试。";
      case "Default":
      default:
        return "登录过程中发生错误，请重试。";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              认证错误
            </h1>
            <p className="text-gray-600">
              {getErrorMessage(error)}
            </p>
          </div>

          {/* Error Details */}
          {error && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                错误代码: <span className="font-mono text-gray-800">{error}</span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push("/login")}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors"
              size="lg"
            >
              重新登录
            </Button>
            
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 rounded-xl transition-colors"
              size="lg"
            >
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              如果问题持续存在，请尝试清除浏览器缓存或联系技术支持。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 