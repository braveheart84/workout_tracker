import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AudioUnlock } from "@/components/audio-unlock";
import { TimezoneSync } from "@/components/timezone-sync";
import { UpdateChecker } from "@/components/update-checker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workout Tracker",
  description:
    "AI-generated workouts and simple logging for strength training and runs.",
  // Adding to iOS's home screen alone doesn't drop Safari's browser chrome -
  // this is what actually tells iOS to launch full-screen/standalone, same
  // effect manifest.ts's display: "standalone" has on Android/Chrome.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workout Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AudioUnlock />
        <TimezoneSync />
        <UpdateChecker />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
