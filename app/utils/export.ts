import type { Incident } from './types';

export const CSV_COLUMNS = [
  'id', 'type', 'severity', 'status', 'title', 'city', 'country', 'country_code', 'region', 'lat', 'lng',
  'started_at', 'mitigating_at', 'resolved_at', 'updated_at', 'affected_asns', 'prefixes', 'detector_score',
  'ris_peers', 'ddos_share_pct', 'signals', 'drop_pct', 'ioda_score', 'aggregated', 'cause', 'source', 'confidence', 'link',
] as const;

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function incidentToRow(inc: Incident): (string | number | boolean | null | undefined)[] {
  return [
    inc.id, inc.type, inc.severity, inc.status, inc.title, inc.location.city, inc.location.country, inc.location.countryCode,
    inc.location.region, inc.location.lat, inc.location.lng, inc.startedAt, inc.mitigatingAt, inc.resolvedAt, inc.updatedAt,
    inc.affectedASNs.map((a) => `AS${a.asn}`).join(' '), inc.metrics.prefixes, inc.metrics.confidence, inc.metrics.peers,
    inc.metrics.sharePct, inc.metrics.signals?.join(' '), inc.metrics.drop, inc.metrics.score, inc.aggregated ?? false, inc.cause, inc.source, inc.confidence, inc.link,
  ];
}

/** RFC 4180 CSV with a header row. */
export function toCsv(incidents: Incident[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const inc of incidents) lines.push(incidentToRow(inc).map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function exportFilename(ext: 'csv' | 'json', now = Date.now()): string {
  return `neteye-incidents-${new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
}

/** Browser-only: trigger a download of text content. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
