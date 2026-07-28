function calendarParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateInTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function shiftCalendarDate(value: string, days: number) {
  const { year, month, day } = calendarParts(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function calendarDateLabel(value: string) {
  const { year, month, day } = calendarParts(value);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
