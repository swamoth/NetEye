/**
 * NetEye incident feed on Cloudflare Workers + Durable Objects.
 *
 * Same job and same wire protocol as server/websocket.js, hosted for free without a sleeping
 * container: browsers open a WebSocket to the Worker, the Worker hands the connection to one
 * Durable Object (`FeedRoom`), and that object runs the 5 s tick as an alarm, asks the shared
 * aggregator for a snapshot, diffs it against the last one, and pushes the difference to every
 * connected socket. With no clients connected the alarm stops, so an idle deployment costs
 * nothing and fetches nothing.
 *
 * The data logic is not duplicated: `server/aggregator.js`, both adapters, the geo tables and
 * `server/feedDiff.js` are bundled here as they are. A new source or a mapping change lands in
 * `server/` once and reaches this Worker and the Node server on the next deploy.
 *
 * Protocol (JSON text frames):
 *   server -> client  { type: 'snapshot',  channel: 'incidents', now, incidents, sources }
 *                     { type: 'update',    channel: 'incidents', now, added, updated, removed, sources }
 *                     { type: 'heartbeat', channel: 'system', now, clients }
 *   client -> server  { type: 'ping' }  ->  { type: 'pong', channel: 'system', now }
 *
 * Secrets and vars (wrangler.toml, `wrangler secret put`): RADAR_API_TOKEN is the Cloudflare
 * Radar token; it is copied into process.env.CLOUDFLARE_API_TOKEN, which the adapter reads.
 * The name differs from the adapter's on purpose: wrangler uses CLOUDFLARE_API_TOKEN for its
 * own login, and the two must never be confused.
 */

import { DurableObject } from 'cloudflare:workers';
import aggregator from '../../../server/aggregator.js';
import { diffIncidents } from '../../../server/feedDiff.js';

export interface Env {
  FEED: DurableObjectNamespace<FeedRoom>;
  RADAR_API_TOKEN?: string;
  IODA_DISABLED?: string;
  WS_TICK_MS?: string;
}

interface Incident { id: string; updatedAt: string; status: string; severity: string }
interface Snapshot { now: string; incidents: Incident[]; sources: unknown[] }

const HEARTBEAT_EVERY_TICKS = 6; // 6 x 5 s = 30 s, as in the Node server
const NOT_A_SOCKET = 'NetEye WebSocket endpoint. Connect with a WebSocket client; /healthz reports status.';

/** The adapters read process.env; Workers expose bindings on `env`, so copy the two that matter. */
function applyEnv(env: Env) {
  if (env.RADAR_API_TOKEN) process.env.CLOUDFLARE_API_TOKEN = env.RADAR_API_TOKEN;
  if (env.IODA_DISABLED) process.env.IODA_DISABLED = env.IODA_DISABLED;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    if (url.pathname === '/healthz' || isSocket) {
      // One room for the one feed. All visitors share it, so upstream is polled once.
      const room = env.FEED.get(env.FEED.idFromName('incidents'));
      return room.fetch(request);
    }
    return new Response(NOT_A_SOCKET, { status: 426, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
} satisfies ExportedHandler<Env>;

export class FeedRoom extends DurableObject<Env> {
  /** Incidents last pushed, by id. Lives in memory; after an eviction the next tick resends a snapshot. */
  private last = new Map<string, Incident>();
  private lastSources: unknown[] = [];
  private ticks = 0;
  private readonly tickMs: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    applyEnv(env);
    this.tickMs = Math.max(1000, Number(env.WS_TICK_MS) || 5000);
    // Answer pings without waking the object (hibernation stays cheap).
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong","channel":"system"}'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return Response.json({ ok: true, clients: this.ctx.getWebSockets().length, incidents: this.last.size, tickMs: this.tickMs });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response(NOT_A_SOCKET, { status: 426, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Full picture first (fetched before the socket is registered, so tick() does not also
    // broadcast it), then the alarm loop takes over.
    if (this.last.size === 0) await this.tick();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'snapshot', channel: 'incidents', now: new Date().toISOString(), incidents: [...this.last.values()], sources: this.lastSources }));
    await this.armAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      if (msg && msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', channel: 'system', now: new Date().toISOString() }));
    } catch {
      /* ignore malformed frames */
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, 'closing');
  }

  async webSocketError(ws: WebSocket) {
    ws.close(1011, 'error');
  }

  /** The 5 s loop. Re-arms itself only while someone is connected. */
  async alarm() {
    if (this.ctx.getWebSockets().length === 0) return;
    await this.tick();
    this.ticks += 1;
    if (this.ticks % HEARTBEAT_EVERY_TICKS === 0) {
      this.broadcast({ type: 'heartbeat', channel: 'system', now: new Date().toISOString(), clients: this.ctx.getWebSockets().length });
    }
    await this.ctx.storage.setAlarm(Date.now() + this.tickMs);
  }

  private async armAlarm() {
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + this.tickMs);
  }

  private async tick() {
    let snap: Snapshot;
    try {
      snap = (await aggregator.getSnapshot()) as Snapshot;
    } catch (err) {
      console.log('snapshot failed:', (err as Error).message);
      return;
    }
    const firstAfterEviction = this.last.size === 0 && this.ctx.getWebSockets().length > 0;
    const { added, updated, removed, current, empty } = diffIncidents(this.last, snap.incidents);
    this.last = current;
    this.lastSources = snap.sources;
    if (firstAfterEviction) {
      // Memory was lost while sockets survived hibernation: resend the full picture.
      this.broadcast({ type: 'snapshot', channel: 'incidents', now: snap.now, incidents: snap.incidents, sources: snap.sources });
    } else if (!empty) {
      this.broadcast({ type: 'update', channel: 'incidents', now: snap.now, added, updated, removed, sources: snap.sources });
    }
  }

  private broadcast(msg: unknown) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch { /* closed between getWebSockets and send */ }
    }
  }
}
