export function formatSum(value: number): string {
  return `${value.toLocaleString("en-US")} so'm`;
}

/** "2026-08-18T09:47:03.000Z" → "18.08.2026, 14:47" (mahalliy) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-08-18T09:47:03.000Z" → "14:47:03" */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
