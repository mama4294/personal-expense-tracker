import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { username: String(credentials.username).trim().toLowerCase() },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.password,
        );

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
        };
      },
    }),
  ],
});
