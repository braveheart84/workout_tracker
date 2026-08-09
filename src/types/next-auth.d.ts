import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// Augmenting "next-auth/jwt" directly doesn't reliably merge here since it
// only re-exports JWT from "@auth/core/jwt" via `export *`, which TypeScript
// declaration merging doesn't follow - augment the source module instead.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
  }
}
