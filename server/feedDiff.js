'use strict';

/**
 * Diff two incident snapshots into the `update` frame the browser applies with applyUpdate().
 * Shared by the Node socket server (server/websocket.js) and the Cloudflare Worker
 * (workers/feed), so both push identical frames.
 *
 * Change detection is cheap on purpose: every mapper bumps updatedAt, status or severity when
 * anything the UI shows changes, so comparing those three fields is enough.
 */

function changed(prev, next) {
  return prev.updatedAt !== next.updatedAt || prev.status !== next.status || prev.severity !== next.severity;
}

/**
 * @param {Map<string, any>} last  incidents last sent, by id
 * @param {any[]} incidents        current incidents
 * @returns {{ added: any[], updated: any[], removed: string[], current: Map<string, any>, empty: boolean }}
 */
function diffIncidents(last, incidents) {
  const current = new Map(incidents.map((i) => [i.id, i]));
  const added = [];
  const updated = [];
  for (const inc of incidents) {
    const prev = last.get(inc.id);
    if (!prev) added.push(inc);
    else if (changed(prev, inc)) updated.push(inc);
  }
  const removed = [...last.keys()].filter((id) => !current.has(id));
  return { added, updated, removed, current, empty: !added.length && !updated.length && !removed.length };
}

module.exports = { diffIncidents, changed };
