import type { TimeEntry } from "../types/api";

// The cabinet works in Tunisia: show times as they were on the office clock.
const clock = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Tunis",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const day = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Tunis",
  day: "2-digit",
  month: "2-digit",
});

/** 45 → "45 min", 60 → "1 h", 125 → "2 h 05". */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

/**
 * When the timer ran, e.g. "09:12 → 10:05", with the stop date when the
 * session crossed midnight. Null for entries typed by hand.
 */
export function timerSpan(
  entry: Pick<TimeEntry, "startedAtUtc" | "stoppedAtUtc">,
) {
  if (!entry.startedAtUtc || !entry.stoppedAtUtc) return null;
  const start = new Date(entry.startedAtUtc);
  const stop = new Date(entry.stoppedAtUtc);
  const stopDay =
    day.format(stop) === day.format(start) ? "" : `${day.format(stop)} `;
  return `${clock.format(start)} → ${stopDay}${clock.format(stop)}`;
}

/** "5 min → 6 min" when the duration was changed after recording. */
export function durationChange(
  entry: Pick<TimeEntry, "originalDurationMinutes" | "durationMinutes">,
) {
  const original = entry.originalDurationMinutes;
  if (original == null || original === entry.durationMinutes) return null;
  return `${formatMinutes(original)} → ${formatMinutes(entry.durationMinutes)}`;
}
