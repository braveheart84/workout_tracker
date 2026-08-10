import type { ReactNode } from "react";

export function FloatingTimerBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="bg-background w-full max-w-lg space-y-2 rounded-md border p-4 text-sm shadow-lg">
        {children}
      </div>
    </div>
  );
}
