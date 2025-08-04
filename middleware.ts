import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// 需要保护的路由
const protectedRoutes = [
  "/chat",
  "/my-style", 
  "/",
  "/results",
  "/welcome",
];

// 公开路由（不需要登录）
const publicRoutes = [
  "/login",
  "/onboarding",
  "/api",
  "/_next",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // 如果是公开路由，直接通过
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // 如果不是受保护的路由，直接通过
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // 获取token
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  // 如果没有token，重定向到登录页面
  if (!token) {
    const loginUrl = new URL("/onboarding", request.url);
    // 保存原始URL作为回调
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // 有token，继续访问
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了以下：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}; 