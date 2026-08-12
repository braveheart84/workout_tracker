// Shared by every dynamic route's loading.tsx (see Next.js's loading file
// convention) - gives an instant, visible response the moment a user clicks
// a link, while the destination page's server-side data fetch is still in
// flight. Without a loading.tsx, a route with no data ready yet shows
// nothing at all until the whole page finishes loading, which is what made
// navigation feel unresponsive with no indication the app was doing
// anything.
export function PageSkeleton() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <div
        className="border-muted-foreground/30 border-t-primary h-8 w-8 animate-spin rounded-full border-4"
        aria-hidden="true"
      />
      <p className="text-muted-foreground text-sm">Loading…</p>
    </main>
  );
}
