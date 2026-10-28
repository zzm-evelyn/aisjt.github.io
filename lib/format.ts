export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  if (iso.length < 16) return iso;
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function formatClock(iso: string): string {
  if (iso.length < 19) return iso;
  return iso.slice(11, 19);
}

export function formatPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
