import type { NextAuthConfig } from "next-auth";

/**
 * Auth configuration with no database access, so the proxy can verify the JWT
 * session cookie without pulling the Prisma client into its bundle. The full
 * config in `auth.ts` adds the credentials provider on top of this.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLogin = request.nextUrl.pathname.startsWith("/login");
      if (isLogin) return true;
      return !!auth;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
