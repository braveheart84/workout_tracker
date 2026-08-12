import { PageSkeleton } from "@/components/page-skeleton";

// No BottomNav here, matching onboarding/page.tsx - onboarding is a
// standalone flow, not part of the main nav.
export default function Loading() {
  return <PageSkeleton />;
}
