import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { LandingSlider } from "./landing-slider";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 text-center">
      <div className="bg-primary/10 text-primary rounded-full p-4">
        <Dumbbell className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Workout Tracker
        </h1>
        <p className="text-muted-foreground max-w-xs text-balance">
          AI-generated workouts, tailored to you.
        </p>
      </div>
      <div className="flex w-full max-w-xs gap-2">
        <Link
          href="/signup"
          className="bg-primary text-primary-foreground flex-1 rounded-md px-4 py-2.5 text-sm font-medium"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="border-input flex-1 rounded-md border px-4 py-2.5 text-sm font-medium"
        >
          Log in
        </Link>
      </div>

      <LandingSlider />
    </main>
  );
}
