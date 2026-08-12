"use client";

import { useActionState, useState } from "react";
import { Dumbbell, CheckCircle2 } from "lucide-react";
import {
  CARDIO_FINISHER_OPTIONS,
  CARDIO_FINISHER_LABELS,
  EQUIPMENT_OPTIONS,
  EQUIPMENT_LABELS,
  type CardioFinisherPreference,
  type Equipment,
} from "@/lib/preferences";
import {
  completeOnboardingAction,
  skipOnboardingAction,
  type OnboardingState,
} from "./actions";

const DURATION_PRESETS = [20, 45, 60] as const;

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-6 rounded-full ${
            i === step ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [unitSystem, setUnitSystem] = useState<"METRIC" | "IMPERIAL">("METRIC");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [cardioFinisher, setCardioFinisher] =
    useState<CardioFinisherPreference>("SOMETIMES");
  const [state, formAction, pending] = useActionState<
    OnboardingState,
    FormData
  >(completeOnboardingAction, undefined);

  function toggleEquipment(option: Equipment) {
    setEquipment((prev) =>
      prev.includes(option)
        ? prev.filter((e) => e !== option)
        : [...prev, option],
    );
  }

  const hiddenFields = (
    <>
      <input type="hidden" name="unitSystem" value={unitSystem} />
      <input
        type="hidden"
        name="preferredDurationMinutes"
        value={duration ?? ""}
      />
      <input
        type="hidden"
        name="cardioFinisherPreference"
        value={cardioFinisher}
      />
      {equipment.map((e) => (
        <input key={e} type="hidden" name="availableEquipment" value={e} />
      ))}
    </>
  );

  return (
    <div className="w-full max-w-md space-y-6">
      <ProgressDots step={step} total={4} />

      {step === 0 && (
        <div className="space-y-6 text-center">
          <Dumbbell className="text-primary mx-auto h-12 w-12" />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome to Workout Tracker
            </h1>
            <p className="text-muted-foreground text-sm">
              Let&apos;s set a few preferences so your workouts are tailored to
              you from the start. This takes about a minute.
            </p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium"
            >
              Get Started
            </button>
            <form action={skipOnboardingAction}>
              <button
                type="submit"
                className="text-muted-foreground w-full text-sm underline"
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Units & equipment
            </h1>
            <p className="text-muted-foreground text-sm">
              You can change these anytime in Settings.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Units</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="unitSystem-step"
                checked={unitSystem === "METRIC"}
                onChange={() => setUnitSystem("METRIC")}
              />
              Metric (kg, km)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="unitSystem-step"
                checked={unitSystem === "IMPERIAL"}
                onChange={() => setUnitSystem("IMPERIAL")}
              />
              Imperial (lb, mi)
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Available equipment (optional, pick any)
            </legend>
            {EQUIPMENT_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={equipment.includes(option)}
                  onChange={() => toggleEquipment(option)}
                />
                {EQUIPMENT_LABELS[option]}
              </label>
            ))}
          </fieldset>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="border-input w-full rounded-md border px-4 py-2 text-sm font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Session preferences
            </h1>
            <p className="text-muted-foreground text-sm">
              We&apos;ll use these as defaults so you don&apos;t have to restate
              them every time you generate a workout.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Preferred session length
            </legend>
            <div className="flex gap-2">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    duration === minutes
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input"
                  }`}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDuration(null)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  duration === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input"
                }`}
              >
                No preference
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Cardio finisher</legend>
            {CARDIO_FINISHER_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cardioFinisher-step"
                  checked={cardioFinisher === option}
                  onChange={() => setCardioFinisher(option)}
                />
                {CARDIO_FINISHER_LABELS[option]}
              </label>
            ))}
          </fieldset>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border-input w-full rounded-md border px-4 py-2 text-sm font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form action={formAction} className="space-y-6 text-center">
          {hiddenFields}
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 dark:text-green-500" />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              You&apos;re all set
            </h1>
            <p className="text-muted-foreground text-sm">
              We&apos;ll use these preferences to tailor every workout we
              generate for you. You can change them anytime in Settings.
            </p>
          </div>

          {state?.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              name="destination"
              value="generate"
              disabled={pending}
              className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Generate My First Workout"}
            </button>
            <button
              type="submit"
              name="destination"
              value="dashboard"
              disabled={pending}
              className="border-input w-full rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              I&apos;ll explore on my own
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-muted-foreground text-sm underline"
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
