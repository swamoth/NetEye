/**
 * Shared domain types. The server (server/aggregator.js, plain JS) produces these shapes;
 * server/aggregator.d.ts binds them for TypeScript consumers.
 */

export type IncidentType = 'outage' | 'bgp' | 'ddos' | 'cable_cut';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'active' | 'mitigating' | 'resolved';
export type SourceId = 'cloudflare_radar' | 'ioda' | (string & {});
export type AsnRole = 'origin' | 'upstream' | 'victim' | 'hijacker' | 'leaker';
export type ArcKind = 'reroute' | 'attack' | 'cable';

export const INCIDENT_TYPES: IncidentType[] = ['outage', 'bgp', 'ddos', 'cable_cut'];
export const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

export interface GeoPoint {
  lat: number;
  lng: number;
  name?: string;
  countryCode?: string;
}

export interface IncidentLocation {
  lat: number;
  lng: number;
  city?: string;
  country: string;
  countryCode: string;
  region: string;
}

export interface ArcPath {
  from: GeoPoint;
  to: GeoPoint;
  kind: ArcKind;
  label?: string;
}

export interface CableRef {
  id: string;
  name: string;
  lengthKm: number;
  capacityTbps: number;
  owners: string;
  rfs: number;
  landings: GeoPoint[];
  /** Index of the landing that starts the faulted segment. */
  faultIndex: number;
  kmFromLanding: number;
}

export interface AffectedASN {
  asn: number;
  name: string;
  role: AsnRole;
}

/**
 * Source-provided figures. Only fields the upstream feed actually reports are present —
 * NetEye never estimates or models metrics.
 */
export interface IncidentMetrics {
  /** BGP: distinct prefixes involved */
  prefixes?: number;
  /** BGP hijacks: Radar detector score (0–12) */
  confidence?: number;
  /** BGP: number of upstream detections collapsed into this incident */
  events?: number;
  /** BGP hijacks: RIS peers that observed the anomaly */
  peers?: number;
  /** DDoS (Radar): share of globally mitigated L3 bytes, trailing 24h */
  sharePct?: number;
  /** Outage (IODA): detection score reported by IODA */
  score?: number;
  /** Outage (IODA): signals that dropped, e.g. BGP, active probing */
  signals?: string[];
  /** Outage (IODA): deepest drop, percent below the recent median */
  drop?: number;
}

export type TimelineEventType = 'detected' | 'confirmed' | 'escalated' | 'mitigating' | 'resolved' | 'update';

export interface TimelineEvent {
  at: string;
  type: TimelineEventType;
  message: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  /** Status at the server's `now`; use statusAt() for replay. */
  status: IncidentStatus;
  title: string;
  description: string;
  cause?: string;
  location: IncidentLocation;
  path?: ArcPath[];
  /** Present for submarine-cable incidents (no live feed today; reserved for a future adapter). */
  cable?: CableRef;
  affectedASNs: AffectedASN[];
  metrics: IncidentMetrics;
  source: SourceId;
  sourceName: string;
  /** True for rolling-window statistics (e.g. Radar attack shares), not discrete events. */
  aggregated?: boolean;
  confidence: number;
  link?: string;
  startedAt: string;
  mitigatingAt?: string;
  resolvedAt?: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export type SourceMode = 'live' | 'disabled';
export type SourceHealth = 'ok' | 'degraded' | 'error' | 'disabled';

export interface SourceStatus {
  id: SourceId;
  name: string;
  mode: SourceMode;
  status: SourceHealth;
  latencyMs: number | null;
  lastPoll: string | null;
  error: string | null;
  /** Types this adapter can serve. */
  types: IncidentType[];
  /** Types fetched successfully in the last poll. */
  coveredTypes: IncidentType[];
  count: number;
}

export interface Snapshot {
  now: string;
  windowMs: number;
  incidents: Incident[];
  sources: SourceStatus[];
}

export interface Stats {
  now: string;
  windowMs: number;
  total: number;
  active: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  activeByType: Record<string, number>;
  bySeverity: Record<string, number>;
  byRegion: Record<string, number>;
  countriesAffected: number;
  /** Sum of the DDoS share percentages currently tracked (how much of global L3 DDoS the pairs cover). */
  ddosShareCoveredPct: number | null;
  topASNs: { asn: number; name: string; incidents: number }[];
  sources: { id: SourceId; status: SourceHealth; count: number }[];
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  now: string;
  uptimeSec: number;
  sources: SourceStatus[];
  incidents: { total: number; active: number };
  websocket: { url: string };
}

// --- WebSocket protocol -------------------------------------------------------

export interface WsSnapshotMessage {
  type: 'snapshot';
  channel: 'incidents';
  now: string;
  incidents: Incident[];
  sources: SourceStatus[];
}

export interface WsUpdateMessage {
  type: 'update';
  channel: 'incidents';
  now: string;
  added: Incident[];
  updated: Incident[];
  removed: string[];
  sources: SourceStatus[];
}

export interface WsHeartbeatMessage {
  type: 'heartbeat' | 'pong';
  channel: 'system';
  now: string;
  clients?: number;
}

export type WsMessage = WsSnapshotMessage | WsUpdateMessage | WsHeartbeatMessage;

export type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

// --- "Am I affected?" ------------------------------------------------------------

export interface WhoAmI {
  ipMasked: string;
  asn: number | null;
  holder: string | null;
  prefix: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

// --- ASN explorer -------------------------------------------------------------

export type NeighbourType = 'upstream' | 'downstream' | 'uncertain';

export interface AsnNeighbour {
  asn: number;
  name: string | null;
  countryCode: string | null;
  type: NeighbourType;
  /** RIPEstat "power": number of RIS peers / paths in which the adjacency appears. */
  power: number;
  location: GeoPoint | null;
}

export interface AsnAnomaly {
  id: string;
  kind: 'hijack' | 'leak';
  role: 'victim' | 'hijacker' | 'leaker' | 'involved';
  title: string;
  startedAt: string;
  endedAt: string | null;
  prefixes: number;
  score: number | null;
  link: string;
}

export interface AsnProfile {
  asn: number;
  name: string | null;
  org: string | null;
  countryCode: string | null;
  country: string | null;
  website: string | null;
  location: IncidentLocation | null;
  announced: boolean;
  /** Counts are null when RIPEstat did not answer (never shown as 0). */
  prefixes: { v4: number | null; v6: number | null; sample: string[] };
  visibility: { v4: { seeing: number; total: number }; v6: { seeing: number; total: number } } | null;
  /** Cloudflare Radar route statistics (RPKI validation state of announced routes). */
  rpki: { total: number; valid: number; invalid: number; unknown: number } | null;
  estimatedUsers: number | null;
  neighbours: { counts: Record<NeighbourType, number> & { unique: number }; top: AsnNeighbour[] };
  anomalies: AsnAnomaly[];
  sources: { ripestat: 'ok' | 'error'; radar: 'ok' | 'disabled' | 'error' };
  fetchedAt: string;
}
