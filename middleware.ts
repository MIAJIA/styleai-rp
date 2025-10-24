import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify, decodeJwt, decodeProtectedHeader, createRemoteJWKSet } from "jose";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

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
  "/terms.html",
  "/privacy.html",
  "/api/apple",
];

const AppAppApiRoutes = [
  "/api/apple1",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log(`[Middleware] 处理路径: ${pathname}`);

  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route =>
    pathname.startsWith(route)
  );
  
  // 如果是公开路由，直接通过
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 检查是否是App API路由（需要JWT验证）
  const isAppApiRoute = AppAppApiRoutes.some(route => 
    pathname.startsWith(route)
  );

  console.log(`[Middleware] isAppApiRoute: ${isAppApiRoute}, isPublicRoute: ${isPublicRoute}`);
  console.log(`[Middleware] request.Method: ${request.method}`);
  console.log(`[Middleware] request.Body: ${JSON.stringify(request.body)}`);
  console.log(`[Middleware] request.Url: ${request.url}`);

  const AppApiRoute = false;
  // 如果是App API路由，进行JWT验证
  if (isAppApiRoute && AppApiRoute) {
    console.log(`[Middleware] 开始验证 JWT for ${pathname}`);
    const supabaseToken = request.headers.get("Authorization") || "";
    if (supabaseToken && supabaseToken.startsWith("Bearer ")) {
      try {
        const token = supabaseToken.split(" ")[1];
        console.log(`[Middleware] 收到token，长度: ${token.length}`);
        
        // 先解码 JWT header 查看算法（不验证签名）
        const header = decodeProtectedHeader(token);
        console.log(`[Middleware] Token Header:`, header);
        
        // 解码 payload 查看内容（不验证签名）
        const unverifiedPayload = decodeJwt(token);
        console.log(`[Middleware] Token issuer:`, unverifiedPayload.iss);
        
        // Supabase 即使有 kid 也使用 JWT secret 验证
        // kid 只是内部的密钥标识符
        console.log(`[Middleware] 使用 JWT Secret 验证`);
        
        if (!SUPABASE_JWT_SECRET) {
          console.error(`[Middleware] SUPABASE_JWT_SECRET 未配置！`);
          return NextResponse.json({ 
            error: "Server configuration error" 
          }, { status: 500 });
        }
        
        const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
        
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
          issuer: unverifiedPayload.iss as string,
          audience: 'authenticated'
        });
        
        // 验证 token 是否过期
        const now = Math.floor(Date.now() / 1000);
        const exp = payload.exp as number;
        
        console.log(`[Middleware] 当前时间: ${now} (${new Date(now * 1000).toISOString()})`);
        console.log(`[Middleware] Token过期时间: ${exp} (${new Date(exp * 1000).toISOString()})`);
        
        if (exp && exp < now) {
          console.error(`[Middleware] Token已过期！过期时间: ${new Date(exp * 1000).toISOString()}`);
          return NextResponse.json({ 
            error: "Token expired",
            expiredAt: new Date(exp * 1000).toISOString()
          }, { status: 401 });
        }
        
        console.log("[Middleware] JWT验证成功:", {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          exp: new Date(exp * 1000).toISOString()
        });
        
        return NextResponse.next();
      } catch (error) {
        console.error("[Middleware] JWT验证失败:", error);
        if (error instanceof Error) {
          console.error("[Middleware] 错误详情:", error.message);
          
          if (error.message.includes('signature verification failed')) {
            console.error("\n❌ JWT 签名验证失败！");
            console.error("📋 请检查以下事项：");
            console.error("1. 在 Supabase Dashboard → Settings → API → JWT Settings");
            console.error("2. 复制 'JWT Secret'（不是 anon key 或 service_role key）");
            console.error("3. 在 .env.local 中设置: SUPABASE_JWT_SECRET=你的JWT_Secret");
            console.error("4. 重启开发服务器");
            console.error(`\n当前 Secret 前10个字符: ${SUPABASE_JWT_SECRET.substring(0, 10)}...`);
          }
        }
        return NextResponse.json({ 
          error: "Unauthorized - Invalid token",
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 401 });
      }
    }
    console.error("[Middleware] 缺少Authorization header");
    return NextResponse.json({ error: "Unauthorized - Missing token" }, { status: 401 });
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * 
     * 注意：现在包含 api 路径，因为我们需要对 /api/apple/* 进行JWT验证
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}; 
