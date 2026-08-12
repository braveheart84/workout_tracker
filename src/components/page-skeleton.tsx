import { Dumbbell } from "lucide-react";

// Shared by every dynamic route's loading.tsx (see Next.js's loading file
// convention) - gives an instant, visible response the moment a user clicks
// a link, while the destination page's server-side data fetch is still in
// flight. Without a loading.tsx, a route with no data ready yet shows
// nothing at all until the whole page finishes loading, which is what made
// navigation feel unresponsive with no indication the app was doing
// anything. The dumbbell rocks (see the `rock` keyframes in globals.css)
// rather than spinning a full 360° - reads more like something being
// lifted than a generic spinner.
export function PageSkeleton() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <Dumbbell
        className="text-primary animate-rock h-8 w-8"
        aria-hidden="true"
      />
      <p className="text-muted-foreground text-sm">Loading…</p>
    </main>
  );
}
