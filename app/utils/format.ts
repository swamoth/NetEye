const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en');

export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return 'n/a';
  return compact.format(n);
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return 'n/a';
  return digits ? n.toFixed(digits) : plain.format(Math.round(n));
}

export function formatPct(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return 'n/a';
  return `${n.toFixed(digits)}%`;
}

/** "3m ago", "2h 15m ago", "in 4m" */
export function formatRelative(iso: string | number, now: number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  const diff = now - t;
  const abs = Math.abs(diff);
  const s = Math.round(abs / 1000);
  let out: string;
  if (s < 45) out = `${s}s`;
  else if (s < 3600) out = `${Math.round(s / 60)}m`;
  else if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    out = m ? `${h}h ${m}m` : `${h}h`;
  } else out = `${Math.round(s / 86400)}d`;
  return diff >= 0 ? `${out} ago` : `in ${out}`;
}

/** Duration between two instants: "48m", "3h 20m", "2d 4h" */
export function formatDuration(fromIso: string, toMs: number): string {
  const ms = Math.max(0, toMs - Date.parse(fromIso));
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export function formatUtcTime(ms: number, withSeconds = true): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

export function formatUtcDateTime(iso: string | number): string {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  return `${date} ${formatUtcTime(d.getTime(), false)} UTC`;
}

export function formatKm(km: number): string {
  return km >= 1000 ? `${(km / 1000).toFixed(1)}k km` : `${Math.round(km)} km`;
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${plain.format(n)} ${n === 1 ? word : pluralWord}`;
}
