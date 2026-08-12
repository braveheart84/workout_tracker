"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

// Detects a new deployment while the app is open - most relevant for the
// installed home-screen icon, which (unlike a normal Safari tab) tends to
// resume a backgrounded session instead of loading fresh, so it can sit on
// old code indefinitely across many opens. Checks once on mount to
// establish a baseline, then again every time the app comes back to the
// foreground (visibilitychange), and shows a dismissible banner rather
// than reloading automatically - an unprompted reload could lose whatever
// someone's mid-way through typing (a logged set, a generation prompt).
export function UpdateChecker() {
  const baselineRef = useRef<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion().then((version) => {
      // Guards against React's dev-mode double-invocation of effects
      // (mount, cleanup, remount) firing this twice - without this, the
      // second call's result could overwrite an already-set baseline,
      // which would make a since-changed version look like "no change"
      // the next time it's checked.
      if (baselineRef.current === null) {
        baselineRef.current = version;
      }
    });

    const checkForUpdate = async () => {
      if (document.visibilityState !== "visible") return;
      const version = await fetchVersion();
      if (!version || !baselineRef.current) return;
      if (version !== baselineRef.current) {
        setNewVersion(version);
      }
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  if (!newVersion || newVersion === dismissedVersion) {
    return null;
  }

  return (
    <div className="bg-primary text-primary-foreground fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm">
      <span>A new version is available.</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 font-medium underline underline-offset-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissedVersion(newVersion)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
