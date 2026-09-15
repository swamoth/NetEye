import type { Incident, IncidentStatus, IncidentType, Severity, Snapshot, SourceStatus, Stats } from '../app/utils/types';

export const WINDOW_MS: number;
export const TYPES: IncidentType[];
export const SEVERITIES: Severity[];

export interface SourceAdapterResult {
  incidents: Incident[];
  status: SourceStatus['status'];
  coveredTypes: IncidentType[];
  latencyMs: number | null;
  lastPoll: string | null;
  error: string | null;
}

export interface SourceAdapter {
  id: string;
  name: string;
  types: IncidentType[];
  fetchIncidents(now: number): Promise<SourceAdapterResult>;
}

export interface Aggregator {
  getSnapshot(now?: number): Promise<Snapshot>;
  getIncident(id: string, now?: number): Promise<Incident | null>;
  getStats(now?: number): Promise<Stats>;
  getSources(now?: number): Promise<SourceStatus[]>;
  sources: SourceAdapter[];
}

export function createAggregator(options?: { sources?: SourceAdapter[] }): Aggregator;
export function statusAt(incident: Pick<Incident, 'startedAt' | 'mitigatingAt' | 'resolvedAt'>, t: number): IncidentStatus | null;

export function getSnapshot(now?: number): Promise<Snapshot>;
export function getIncident(id: string, now?: number): Promise<Incident | null>;
export function getStats(now?: number): Promise<Stats>;
export function getSources(now?: number): Promise<SourceStatus[]>;
