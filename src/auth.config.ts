import type { NextAuthConfig } from "next-auth";

// Kept separate from auth.ts (and Prisma-free) so it can be imported by
// middleware.ts, which runs on the Edge runtime and can't load Prisma's
// Node-only generated client. JWT session verification here doesn't need
// database access - only the Credentials provider's `authorize` (auth.ts)
// does, and that never runs in middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = ["/dashboard", "/settings", "/exercises"];
      const isProtectedRoute = protectedPrefixes.some((prefix) =>
        nextUrl.pathname.startsWith(prefix),
      );
      return !isProtectedRoute || isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
