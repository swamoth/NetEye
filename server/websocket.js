'use strict';

/**
 * NetEye WebSocket fan-out server.
 *
 * Runs next to the Next.js app (default port 3001) and pushes incident changes to browsers so
 * the globe updates without polling. It has no state of its own: every tick it asks the shared
 * aggregator for the current snapshot and broadcasts a diff against the last one it sent.
 *
 * Protocol (JSON text frames, all carry `channel` so more feeds can be multiplexed later):
 *   server -> client
 *     { type: 'snapshot',  channel: 'incidents', now, incidents: Incident[], sources: SourceStatus[] }
 *     { type: 'update',    channel: 'incidents', now, added: Incident[], updated: Incident[], removed: string[], sources }
 *     { type: 'heartbeat', channel: 'system', now, clients }
 *   client -> server
 *     { type: 'ping' }  ->  { type: 'pong', now }
 *
 * Usage:  node server/websocket.js      (reads .env.local if present; WS_PORT, WS_TICK_MS)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// --- minimal .env.local loader (avoids a dotenv dependency) ------------------
for (const file of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const { WebSocketServer, WebSocket } = require('ws');
const aggregator = require('./aggregator');

const PORT = Number(process.env.WS_PORT || 3001);
const TICK_MS = Number(process.env.WS_TICK_MS || 5000);
const HEARTBEAT_MS = 30_000;

const log = (...args) => console.log(new Date().toISOString(), '[ws]', ...args);

// Plain HTTP server underneath so /healthz works for load balancers / uptime checks.
const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size, uptimeSec: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(426, { 'content-type': 'text/plain' });
  res.end('NetEye WebSocket endpoint — upgrade required');
});

const wss = new WebSocketServer({ server: httpServer, clientTracking: true });

/** @type {Map<string, any>} last snapshot broadcast, by incident id */
let last = new Map();
let lastSources = [];

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(data);
}

/** Cheap change detection: status/metrics/timeline changes all bump updatedAt or status. */
function changed(prev, next) {
  return prev.updatedAt !== next.updatedAt || prev.status !== next.status || prev.severity !== next.severity;
}

async function tick() {
  let snap;
  try {
    snap = await aggregator.getSnapshot();
  } catch (err) {
    log('snapshot failed:', err.message);
    return;
  }
  const current = new Map(snap.incidents.map((i) => [i.id, i]));
  const added = [];
  const updated = [];
  for (const inc of snap.incidents) {
    const prev = last.get(inc.id);
    if (!prev) added.push(inc);
    else if (changed(prev, inc)) updated.push(inc);
  }
  const removed = [...last.keys()].filter((id) => !current.has(id));
  last = current;
  lastSources = snap.sources;

  if (added.length || updated.length || removed.length) {
    broadcast({ type: 'update', channel: 'incidents', now: snap.now, added, updated, removed, sources: snap.sources });
    if (added.length || removed.length) log(`update → +${added.length} ~${updated.length} -${removed.length} (clients: ${wss.clients.size})`);
  }
}

wss.on('connection', async (ws, req) => {
  const ip = req.socket.remoteAddress;
  log('client connected', ip, 'total', wss.clients.size);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg && msg.type === 'ping') send(ws, { type: 'pong', channel: 'system', now: new Date().toISOString() });
    } catch { /* ignore malformed frames */ }
  });
  ws.on('close', () => log('client disconnected', ip, 'total', wss.clients.size));

  // Send the full picture immediately; the diff loop takes over from there.
  if (last.size === 0) await tick();
  send(ws, { type: 'snapshot', channel: 'incidents', now: new Date().toISOString(), incidents: [...last.values()], sources: lastSources });
});

// Liveness: drop clients that stopped answering pings.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  broadcast({ type: 'heartbeat', channel: 'system', now: new Date().toISOString(), clients: wss.clients.size });
}, HEARTBEAT_MS);

setInterval(tick, TICK_MS);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`port ${PORT} already in use — is another NetEye WS server running? Browsers will fall back to polling.`);
    process.exit(0);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  log(`listening on ws://localhost:${PORT}  (tick ${TICK_MS} ms)`);
  tick();
});

process.on('SIGINT', () => { log('shutting down'); wss.close(); httpServer.close(); process.exit(0); });
process.on('SIGTERM', () => { wss.close(); httpServer.close(); process.exit(0); });
