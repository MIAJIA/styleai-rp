import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn(params: any) {
      console.log("Sign in attempt:", params);
      console.log("Google Client ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Not Set");
      console.log("Google Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not Set");
      console.log("GitHub ID:", process.env.GITHUB_ID ? "Set" : "Not Set");
      console.log("GitHub Secret:", process.env.GITHUB_SECRET ? "Set" : "Not Set");

      return true;
    },
    async redirect(params: any) {
      console.log("Redirect params:", params);
      // 修复重定向逻辑
      if (params.url.startsWith('/')) {
        // 确保baseUrl不以斜杠结尾，url以斜杠开头
        const baseUrl = params.baseUrl.endsWith('/') ? params.baseUrl.slice(0, -1) : params.baseUrl;
        return `${baseUrl}${params.url}`;
      }
      // 如果是外部URL，直接返回
      if (params.url.startsWith('http')) {
        return params.url;
      }
      // 默认返回baseUrl
      return params.baseUrl;
    },
    async session({ session, token, user }: any) {
      console.log("Session callback - Input:", { session, token, user });

      // 保存用户信息到 session
      if (token) {
        session.user.id = token.sub;
        session.user.provider = token.provider;
        session.accessToken = token.accessToken;
      }

      console.log("Session callback - Output:", session);
      return session;
    },
    async jwt({ token, user, account, profile }: any) {
      console.log("JWT callback - Input:", { token, user, account, profile });

      // 保存账户信息到 JWT
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      if (user) {
        token.id = user.id;
      }

      console.log("JWT callback - Output:", token);
      return token;
    },
  },
  pages: {
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }