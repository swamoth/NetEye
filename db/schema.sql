-- NetEye persistence schema (PostgreSQL 15+ with the TimescaleDB extension).
--
-- Not required to run the app: the default MemoryStore (lib/db.ts) serves everything from the
-- aggregator. Apply this when you want history beyond 24 h, cross-instance consistency for the
-- API, or analytics (Internet Health Index, leaderboards).
--
--   psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TYPE incident_type AS ENUM ('outage', 'bgp', 'ddos', 'cable_cut');
CREATE TYPE severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('active', 'mitigating', 'resolved');

-- One row per incident (latest known state). Small table, plain PK.
CREATE TABLE incidents (
  id             TEXT PRIMARY KEY,
  type           incident_type   NOT NULL,
  severity       severity        NOT NULL,
  status         incident_status NOT NULL,
  title          TEXT            NOT NULL,
  description    TEXT            NOT NULL,
  cause          TEXT,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  city           TEXT,
  country        TEXT            NOT NULL,
  country_code   CHAR(2)         NOT NULL,
  region         TEXT            NOT NULL,
  source         TEXT            NOT NULL,
  aggregated     BOOLEAN         NOT NULL DEFAULT FALSE,
  confidence     REAL            NOT NULL,
  affected_asns  INTEGER[]       NOT NULL DEFAULT '{}',
  payload        JSONB           NOT NULL,           -- full Incident document (path, cable, propagation, ...)
  started_at     TIMESTAMPTZ     NOT NULL,
  mitigating_at  TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ     NOT NULL,
  ingested_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX incidents_started_at_idx ON incidents (started_at DESC);
CREATE INDEX incidents_active_idx     ON incidents (status) WHERE status <> 'resolved';
CREATE INDEX incidents_country_idx    ON incidents (country_code);
CREATE INDEX incidents_asns_idx       ON incidents USING GIN (affected_asns);

-- Source-reported metric samples over time -> hypertable (e.g. RIS peer counts, prefix counts,
-- DDoS shares as they change between polls).
CREATE TABLE incident_metrics (
  time             TIMESTAMPTZ NOT NULL,
  incident_id      TEXT        NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  metrics          JSONB       NOT NULL
);
SELECT create_hypertable('incident_metrics', 'time', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX incident_metrics_incident_idx ON incident_metrics (incident_id, time DESC);

-- Timeline events (detected / confirmed / mitigating / resolved / update).
CREATE TABLE incident_events (
  time        TIMESTAMPTZ NOT NULL,
  incident_id TEXT        NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  message     TEXT        NOT NULL
);
SELECT create_hypertable('incident_events', 'time', chunk_time_interval => INTERVAL '7 days');

-- Source polling health, for /api/health history and SLO dashboards.
CREATE TABLE source_polls (
  time       TIMESTAMPTZ NOT NULL,
  source     TEXT        NOT NULL,
  status     TEXT        NOT NULL,
  latency_ms INTEGER,
  count      INTEGER,
  error      TEXT
);
SELECT create_hypertable('source_polls', 'time', chunk_time_interval => INTERVAL '7 days');

-- Hourly roll-up used for the Internet Health Index / leaderboards.
CREATE MATERIALIZED VIEW incidents_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', started_at) AS bucket,
       type, severity, region, country_code,
       count(*)              AS incidents
FROM incidents
GROUP BY bucket, type, severity, region, country_code;

SELECT add_continuous_aggregate_policy('incidents_hourly',
  start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '1 hour');

-- Keep 90 days of raw metrics, forever for incidents.
SELECT add_retention_policy('incident_metrics', INTERVAL '90 days');
