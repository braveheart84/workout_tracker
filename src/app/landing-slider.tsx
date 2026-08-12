"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dumbbell,
  CheckCircle2,
  Sparkles,
  CalendarDays,
  LayoutTemplate,
} from "lucide-react";

const AUTO_ADVANCE_MS = 4000;
// How long a manual swipe/click suppresses auto-advance before it resumes -
// long enough that auto-advance doesn't immediately fight a user mid-look,
// short enough that the slider doesn't just stop for someone who taps once.
const RESUME_AFTER_MANUAL_MS = 6000;

function TodaysPlanSlide() {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        AI-generated workouts
      </p>
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary rounded-full p-2">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            Push Day: Chest &amp; Shoulders
          </p>
          <p className="text-muted-foreground text-xs">
            5 blocks · 8 exercises
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <p className="text-muted-foreground text-xs">
          Adjusts automatically from your last few sessions
        </p>
      </div>
    </div>
  );
}

function WeekSlide() {
  const week = [
    { d: "M", done: true },
    { d: "T", done: true },
    { d: "W", done: false, today: true },
    { d: "T", done: false },
    { d: "F", done: false },
    { d: "S", done: false },
    { d: "S", done: false },
  ];
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Track your week at a glance
      </p>
      <div className="flex justify-between">
        {week.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-[10px] font-medium uppercase">
              {day.d}
            </span>
            <span
              className={
                day.today
                  ? "border-primary flex h-7 w-7 items-center justify-center rounded-full border-2"
                  : "flex h-7 w-7 items-center justify-center rounded-full"
              }
            >
              {day.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : day.today ? (
                <span className="bg-primary h-1.5 w-1.5 rounded-full" />
              ) : (
                <span className="bg-muted h-1.5 w-1.5 rounded-full" />
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground border-t pt-3 text-xs">
        2 workouts done this week, right on track
      </p>
    </div>
  );
}

function HistorySlide() {
  const dots = [0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 1];
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Full history, always at hand
      </p>
      <div className="flex items-center gap-2">
        <CalendarDays className="text-primary h-5 w-5" />
        <p className="text-sm font-semibold">August 2026</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {dots.map((v, i) => (
          <div
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px]"
          >
            {v === 1 ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ) : v === 2 ? (
              <span className="bg-primary h-1.5 w-1.5 rounded-full" />
            ) : (
              <span className="text-muted-foreground/40">·</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground border-t pt-3 text-xs">
        Every workout, logged and searchable
      </p>
    </div>
  );
}

function TemplatesSlide() {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Save your go-to routines
      </p>
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary rounded-full p-2">
          <LayoutTemplate className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Leg Day (Heavy)</p>
          <p className="text-muted-foreground text-xs">
            Saved template · one tap to start
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <Sparkles className="text-primary h-4 w-4" />
        <p className="text-muted-foreground text-xs">
          Reuse a favorite session anytime
        </p>
      </div>
    </div>
  );
}

const SLIDES = [TodaysPlanSlide, WeekSlide, HistorySlide, TemplatesSlide];

// Distance (in viewport px) from the track's visible center to a child's
// center - used both to scroll a given slide into the centered/snapped
// position and, in reverse, to figure out which slide is currently
// centered after a manual swipe.
function centerDelta(track: HTMLElement, child: HTMLElement) {
  const trackRect = track.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  return (
    childRect.left +
    childRect.width / 2 -
    (trackRect.left + trackRect.width / 2)
  );
}

export function LandingSlider() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    const child = track?.children[index] as HTMLElement | undefined;
    if (!track || !child) return;
    track.scrollTo({
      left: track.scrollLeft + centerDelta(track, child),
      behavior: "smooth",
    });
  }

  function pauseAutoAdvance() {
    pausedUntilRef.current = Date.now() + RESUME_AFTER_MANUAL_MS;
  }

  // Auto-advance, skipped while a recent manual interaction has it paused.
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      scrollToIndex((activeIndexRef.current + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(interval);
  }, []);

  // Keeps the dots in sync with whichever slide is actually centered,
  // whether that's from auto-advance or a manual swipe - one code path for
  // both instead of tracking them separately.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let settleTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(settleTimeout);
      settleTimeout = setTimeout(() => {
        const children = Array.from(track.children) as HTMLElement[];
        let closest = 0;
        let closestDist = Infinity;
        children.forEach((child, i) => {
          const dist = Math.abs(centerDelta(track, child));
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });
        setActiveIndex(closest);
      }, 120);
    };
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", handleScroll);
      clearTimeout(settleTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-md space-y-3">
      <div
        ref={trackRef}
        onPointerDown={pauseAutoAdvance}
        onWheel={pauseAutoAdvance}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((Slide, i) => (
          <div
            key={i}
            className="w-[78%] shrink-0 snap-center rounded-md border p-4 text-left shadow-sm"
          >
            <Slide />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => {
              pauseAutoAdvance();
              scrollToIndex(i);
            }}
            className={
              i === activeIndex
                ? "bg-primary h-1.5 w-4 rounded-full transition-all"
                : "bg-muted h-1.5 w-1.5 rounded-full transition-all"
            }
          />
        ))}
      </div>
    </div>
  );
}
