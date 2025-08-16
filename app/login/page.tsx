"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Chrome, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to home page if user is already logged in
  useEffect(() => {
    console.log("Login page - Status:", status);
    console.log("Login page - Session:", session);

    if (status === "authenticated" && session) {
      console.log("User authenticated, redirecting to /");
      router.push("/");
    }
  }, [session, status, router]);

  // Show loading state if loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't show login page if already authenticated
  if (status === "authenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    console.log("Google login button clicked");
    try {
      const result = await signIn("google", {
        callbackUrl: "/",
        redirect: false,
      });
      console.log("Sign in result:", result);

      if (result?.error) {
        console.error("Sign in error:", result.error);
        alert(`Google login failed: ${result.error}`);
      } else if (result?.url) {
        console.log("Redirecting to:", result.url);
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Google login failed. Please check your network connection or contact administrator.");
    }
  };

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
        alert(`GitHub login failed: ${result.error}`);
      } else if (result?.url) {
        console.log("Redirecting to:", result.url);
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("GitHub login failed. Please check your network connection or contact administrator.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          {/* Logo/Title */}
          <div className="mb-8">
            <h1 className="font-playfair text-3xl font-bold text-gray-800 mb-2">
              StyleMe
            </h1>
            <p className="text-gray-600">
              Sign in to access your personalized fashion assistant
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            {/* Google Login Button */}
            <Button
              onClick={handleGoogleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-3"
              size="lg"
            >
              <Chrome className="w-5 h-5" />
              Sign in with Google
            </Button>

            {/* GitHub Login Button */}
            <Button
              onClick={handleGitHubLogin}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-3"
              size="lg"
            >
              <Github className="w-5 h-5" />
              Sign in with GitHub
            </Button>

            <div className="text-xs text-gray-500">
              After signing in, you can access all features including AI stylist, personal style profile, and more
            </div>

          </div>

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              After signing in, you can:
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                <span>Chat with AI stylist</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>View personal style profile</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Save and manage your looks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Access account settings and balance</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}