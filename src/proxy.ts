import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// `middleware.ts` is deprecated in Next.js 16; this is the `proxy` convention,
// which runs on the Node.js runtime. It gates every page and API route on a
// valid session cookie and never touches the database.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
