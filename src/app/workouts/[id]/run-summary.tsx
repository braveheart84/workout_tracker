import {
  formatDistance,
  formatDurationHms,
  formatPace,
  type DistanceUnit,
} from "@/lib/distance";

// The one Set a run-upload session's Running exercise carries (PRD 7.7) -
// a nicer, unit-aware "at a glance" summary than the generic exercise/set
// list below it, which shows raw meters with no pace/heart-rate/calories.
export function RunSummary({
  distanceMeters,
  durationSeconds,
  avgHeartRateBpm,
  calories,
  unit,
}: {
  distanceMeters: number;
  durationSeconds: number;
  avgHeartRateBpm: number | null;
  calories: number | null;
  unit: DistanceUnit;
}) {
  const pace = formatPace(durationSeconds, distanceMeters, unit);

  return (
    <div className="grid grid-cols-2 gap-4 rounded-md border p-4 text-sm">
      <div>
        <p className="text-muted-foreground text-xs">Distance</p>
        <p className="text-lg font-semibold">
          {formatDistance(distanceMeters, unit)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Time</p>
        <p className="text-lg font-semibold">
          {formatDurationHms(durationSeconds)}
        </p>
      </div>
      {pace && (
        <div>
          <p className="text-muted-foreground text-xs">Avg Pace</p>
          <p className="text-lg font-semibold">{pace}</p>
        </div>
      )}
      {avgHeartRateBpm != null && (
        <div>
          <p className="text-muted-foreground text-xs">Avg Heart Rate</p>
          <p className="text-lg font-semibold">{avgHeartRateBpm} bpm</p>
        </div>
      )}
      {calories != null && (
        <div>
          <p className="text-muted-foreground text-xs">Calories</p>
          <p className="text-lg font-semibold">{calories}</p>
        </div>
      )}
    </div>
  );
}
