import { BottomNav } from "@/components/bottom-nav";
import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <PageSkeleton />
      <BottomNav />
    </>
  );
}
