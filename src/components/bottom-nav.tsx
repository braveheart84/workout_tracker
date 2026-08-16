"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Dumbbell,
  MoreHorizontal,
  X,
  CalendarDays,
  History,
  BookOpen,
  LayoutTemplate,
  Footprints,
  Settings,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/app/sign-out-action";

const MORE_LINKS = [
  { href: "/runs/new", label: "Log a run", icon: Footprints },
  { href: "/week", label: "Week view", icon: CalendarDays },
  { href: "/history", label: "History", icon: History },
  { href: "/exercises", label: "Exercise library", icon: BookOpen },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/settings", label: "Account settings", icon: Settings },
] as const;

// Nav redesign, Concept B: only two persistent destinations (today's
// dashboard, generate) pinned to the bottom, everything else tucked behind
// "More" - replaces the long link row that used to sit at the bottom of
// the dashboard. Rendered per-page (no shared layout exists yet to hang a
// single instance off), so every authenticated page mounts its own copy.
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isHome = pathname === "/dashboard";
  const isGenerate = pathname.startsWith("/generate");

  return (
    <>
      <nav className="bg-card fixed inset-x-0 bottom-0 z-40 border-t">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 px-4 py-1 text-xs ${
              isHome ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            <Home size={20} />
            Home
          </Link>
          <Link
            href="/generate"
            className={`flex flex-col items-center gap-1 px-4 py-1 text-xs ${
              isGenerate ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            <Dumbbell size={20} />
            Generate
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-muted-foreground flex flex-col items-center gap-1 px-4 py-1 text-xs"
          >
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="bg-card absolute inset-x-0 bottom-0 space-y-1 rounded-t-2xl border-t p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            {MORE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm"
              >
                <Icon size={17} className="text-muted-foreground" />
                {label}
              </Link>
            ))}
            <form action={signOutAction} className="border-t pt-2">
              <button
                type="submit"
                className="text-destructive flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
