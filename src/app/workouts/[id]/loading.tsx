import { PageSkeleton } from "@/components/page-skeleton";

// No BottomNav here, matching workouts/[id]/page.tsx - FloatingTimerBar is
// fixed at the same bottom position and would collide with it.
export default function Loading() {
  return <PageSkeleton />;
}
