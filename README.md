# NetEye: live internet incidents on a globe

Outages, BGP route leaks and hijacks, and DDoS activity from the last 24 hours, plotted live on a
3D globe, with a replay scrubber, per-incident forensics, an ASN explorer with a live BGP stream,
shareable views and a documented API. Next.js 15, TypeScript, Tailwind, globe.gl.

> **Real data only.** Every incident, count and chart comes from a live upstream feed: Cloudflare
> Radar for incidents, RPKI statistics and ASN metadata; IODA for country-level outage detections;
> RIPEstat for prefixes, neighbours and visibility; RIPE RIS Live for BGP updates. NetEye never
> estimates, models or simulates a value.
> When a feed is unavailable the layer is absent and `/api/health` says why.

## What it does

- **Live 3D globe.** Night-lights Earth; incident markers sized by severity and coloured by type;
  pulsing rings on active incidents; animated arcs for BGP hijacks and leaks (hijacker to victim,
  leaker to upstream) and for DDoS origin to target flows; countries with active incidents
  highlighted. Auto-rotates until you interact.
- **Live feed with graceful degradation.** WebSocket diff stream every 5 s, automatic fallback to
  HTTP polling and automatic reconnection. The header shows Live, Polling or Offline.
- **24 h replay.** Scrub or play the last day at 1x to 300x. Every marker, ring, count and list
  row is recomputed for that instant in the browser.
- **Incident forensics.** Type, severity, status and source badges, cause, lifecycle timing,
  the exact figures the source reported (prefixes, detector score, RIS peers, DDoS share),
  networks involved with roles (victim, hijacker, leaker, upstream), and the event timeline.
- **ASN explorer.** Open any autonomous system: announced prefixes, RIS visibility, neighbour
  counts with the top upstreams and customers drawn as arcs, RPKI route-origin validation as a
  stacked bar with the invalid count called out, routing anomalies of the last 7 days, and a
  prefix sample. Drill from neighbour to neighbour.
- **Live BGP stream.** One click streams announcements and withdrawals for routes the network
  originates, straight from RIPE RIS Live into the browser: updates per second, peers and
  collectors seen, the latest updates, and an arc on the globe from the collector that observed
  each one.
- **"Am I affected?"** Resolves your ISP and ASN through RIPEstat, highlights incidents touching
  your network or country, and opens your own network in the explorer. Opt-in; the IP is masked
  and never logged.
- **Command palette** (`Ctrl/⌘ K` or `/`): incidents, any ASN (`AS13335`), cities, countries,
  35 submarine cable routes, and actions.
- **Shareable permalinks.** Camera, filters, search, selection, replay time and the open ASN
  live in the URL.
- **Export and feeds.** CSV or JSON of the filtered list, an RSS feed, REST and WebSocket APIs.

## Technology

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | SSR of the initial snapshot puts the incident list in the first HTML; API routes host the REST layer and proxy the upstreams |
| 3D | [globe.gl](https://github.com/vasturiano/globe.gl) via react-globe.gl (Three.js) | Points, rings, arcs, paths, polygons, labels and camera fly-to out of the box; `Globe.tsx` isolates it behind a plain data contract |
| UI | Tailwind CSS 3, Geist Sans and Mono (`next/font/local`), Phosphor icons, metal-fx | Quiet monochrome chrome (near-black paper, hairlines, mono meta); colour reserved for the validated incident-type palette and status |
| Realtime | `ws` server (`server/websocket.js`) with polling fallback; RIS Live directly in the browser | Diff fan-out every 5 s; no shared state between processes |
| Geo | Natural Earth 1:110m via `world-atlas` and `topojson-client` | Country polygons and point-in-country lookup, served statically |
| Tests | Vitest | Radar mappers against real payload fixtures, aggregator with injected adapters, geo math, filters and URL state |

## Data sources

| Source | Used for | Key | Cost |
|---|---|---|---|
| **Cloudflare Radar** | Outage annotations, BGP hijack and leak events, L3 DDoS origin/target shares, ASN metadata and estimated users, RPKI route statistics, anomaly history | `CLOUDFLARE_API_TOKEN` (free account, *Account → Radar → Read*) | free |
| **IODA** (Georgia Tech) | Country-level outage detections: BGP-visible prefixes, active probing, darknet telescope and Google traffic signals, merged per country with the depth of each drop | none (`IODA_DISABLED=1` to turn off) | free |
| **RIPEstat Data API** | ASN overview, announced prefixes, routing status and visibility, AS neighbours, "Am I affected?" lookups | none | free |
| **RIPE RIS Live** | Real-time BGP updates for the ASN explorer | none | free |

Submarine cable *faults* have no free real-time feed, so that layer stays empty and its filter is
disabled with a "no feed" label. The 35 cable routes in the palette are real infrastructure
geometry (approximate landing coordinates) and are shown as routes, not as incidents.

## Quick start

Requirements: Node.js 20 or newer, npm 9 or newer.

```bash
git clone https://github.com/swamoth/NetEye.git
cd NetEye
npm install
cp .env.example .env.local          # add CLOUDFLARE_API_TOKEN
npm run dev                          # Next.js on :3000 plus the WebSocket server on :3001
```

Open <http://localhost:3000>. Without a token the incident layers are empty (the dashboard says
so); the ASN explorer still works on RIPEstat and RIS Live alone.

### Getting a Cloudflare Radar token (free)

1. Create an account at <https://dash.cloudflare.com/sign-up> (no domain needed).
2. My Profile → **API Tokens** → Create Token → *Custom token*.
3. Permissions: **Account · Radar · Read**. Create it and copy it once.
4. Put it in `.env.local` as `CLOUDFLARE_API_TOKEN=…` (never with a `NEXT_PUBLIC_` prefix).
5. Verify: `curl -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server and WebSocket server together |
| `npm run dev:web` / `npm run dev:ws` | Either process alone (the app polls if the socket is absent) |
| `npm run build` / `npm start` | Production build / run both processes |
| `npm test` | Vitest suite |
| `npm run lint` / `npm run typecheck` | ESLint (next/core-web-vitals) / `tsc --noEmit` |

### Environment

```env
CLOUDFLARE_API_TOKEN=          # Cloudflare Radar (incident feed, RPKI stats, ASN metadata)
RADAR_CACHE_TTL_MS=60000       # upstream cache for the incident feed
WS_PORT=3001                   # WebSocket server port
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

See [`.env.example`](.env.example) for the full list.

## Keyboard

`Ctrl/⌘ K` or `/` search · `Space` play or pause replay · `L` go live · `F` toggle the list · `Esc` close

## API

```
GET /api/outages?type=bgp&severity=high,critical&since=-6h&q=mumbai&format=csv
GET /api/outages/:id
GET /api/stats
GET /api/asn/:asn          # RIPEstat + Radar profile: prefixes, RPKI, neighbours, anomalies
GET /api/health            # per-source status, 207 when degraded or unconfigured
GET /api/feed              # RSS 2.0
GET /api/whoami            # RIPEstat-backed ASN and location lookup (IP masked)
WS  ws://localhost:3001    # snapshot and diff stream
```

## Project structure

```
NetEye/
├── app/
│   ├── page.tsx                  # server component: SSR initial snapshot → <App/>
│   ├── layout.tsx · globals.css · icon.svg
│   ├── components/
│   │   ├── App.tsx               # client shell: state, filters, selection, explorer, URL sync
│   │   ├── Globe.tsx             # react-globe.gl wrapper (the only file that knows Three.js)
│   │   ├── OutageMarker.tsx      # incidents → globe layers (stable datum identity)
│   │   ├── AsnExplorer.tsx · AsnLayers.ts · charts.tsx
│   │   ├── Header.tsx · Dashboard.tsx · OutageDetail.tsx · Timeline.tsx
│   │   ├── CommandPalette.tsx · BootOverlay.tsx · ui.tsx
│   ├── hooks/                    # useOutages · useReplayClock · useGeoData · useWhoAmI · useAsnProfile · useRisLive · useUrlState
│   ├── utils/                    # types · incidents · coordinates · theme · format · export · api
│   └── api/                      # outages · outages/[id] · stats · health · feed · whoami · asn/[asn]
├── server/
│   ├── aggregator.js             # merges live source adapters (createAggregator for tests)
│   ├── websocket.js              # :3001 diff fan-out
│   ├── geo.js                    # geolocation helpers
│   ├── sources/cloudflareRadar.js
│   └── data/                     # cities · cables · asns · countries · rrc (RIS collectors)
├── lib/                          # incidents (server facade) · db (IncidentStore) · ripestat · radar
├── db/schema.sql                 # optional TimescaleDB schema
├── tests/                        # vitest
├── app/globe/                    # dotEarthMaterial (COBE-style lattice shader) · fibonacci (lattice maths)
└── public/data/                  # countries-110m.json (Natural Earth): country layer, ASCII boot world and the globe surface
```

## Roadmap

- IODA outage signals and TeleGeography cable GeoJSON as further adapters (real cable faults).
- Paste-your-traceroute visualiser; watchlists with webhooks; Postgres history beyond 24 h.

## Deploy

Two services, both free: the Next.js app on Vercel and the WebSocket feed on Cloudflare Workers
(a Durable Object holds the connections and runs the 5 s tick as an alarm, so nothing sleeps
and nothing runs while no one is connected). The browser falls back to HTTP polling every 15 s
whenever the socket is unreachable.

**1. Feed on Cloudflare Workers** (free plan, no card)

```bash
npm run worker:login      # opens the browser once (GitHub sign-in works)
npm run worker:secret     # asks for the Radar token, paste it
npm run worker:deploy     # prints https://neteye-feed.<account>.workers.dev
```

Check: `https://neteye-feed.<account>.workers.dev/healthz` returns `{"ok":true,...}`.
Local run: copy `workers/feed/.dev.vars.example` to `.dev.vars`, then `npm run worker:dev`
(`ws://localhost:8787`). Use the npm scripts rather than bare `npx wrangler`: they run wrangler
inside `workers/feed`, because from the project root wrangler loads `.env.local` and mistakes
the Radar `CLOUDFLARE_API_TOKEN` for its own login token. That is also why the Worker secret is
named `RADAR_API_TOKEN`.

**2. App on Vercel** (Hobby, no card)

- Import the repository. Framework preset: Next.js, nothing to change.
- Environment variables, set before the first build: `CLOUDFLARE_API_TOKEN` (the Radar token)
  and `NEXT_PUBLIC_WS_URL=wss://neteye-feed.<account>.workers.dev`. `NEXT_PUBLIC_` values are
  inlined at build time, so a change needs a redeploy.
- Open the deployment. The header shows "Live" when the socket connects, "Polling" otherwise,
  and `/api/health` lists both sources.

`server/websocket.js` remains the local and self-hosted socket server (`npm run dev`,
`npm start`); it speaks the same protocol as the Worker. `IODA_DISABLED=1` turns the IODA
source off on any of them.

**Updating later**: data logic lives in `server/` and is shared by the Node server and the
Worker. A new source or a mapping change is one edit there, then `npm run worker:deploy` for
the feed and a push to `main` for the app.

## Development

```bash
npm test            # unit tests
npm run typecheck   # tsc
npm run lint        # eslint
npm run build       # production build (also type-checks)
```

## Team Collaboration Guide

This section provides step-by-step instructions for team members to contribute to the NetEye project.

### Initial Setup

1. **Fork the repository** (if working on personal fork)
   - Visit the repository on GitHub
   - Click the "Fork" button in the top-right corner
   - This creates a copy under your GitHub account

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/neteye.git
   cd neteye
   ```

3. **Add upstream remote** (to sync with original repository)
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/neteye.git
   ```

4. **Verify remotes**
   ```bash
   git remote -v
   ```
   You should see:
   - `origin` pointing to your fork
   - `upstream` pointing to the original repository

### Daily Development Workflow

1. **Sync with upstream** (before starting work)
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Use descriptive branch names:
   - `feature/add-cable-filter`
   - `bugfix/globe-zoom-issue`
   - `update/readme-typo`

3. **Make your changes**
   - Edit files
   - Test locally with `npm run dev`
   - Follow existing code style

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add submarine cable filtering"
   ```
   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Creating a Pull Request

1. **Navigate to the repository** on GitHub

2. **Click "New Pull Request"**
   - GitHub usually shows a prompt: "Compare & pull request"
   - Or go to Pull Requests tab → New Pull Request

3. **Configure the PR**
   - Base: `main` branch of original repository
   - Compare: Your feature branch

4. **Fill in the PR template**
   ```
   ## Description
   Brief description of what this PR does

   ## Changes Made
   - List of specific changes
   - Another change

   ## Testing
   - How you tested the changes
   - Test results

   ## Screenshots (if applicable)
   [Add screenshots for UI changes]

   ## Related Issues
   Fixes #123
   ```

5. **Submit the PR**
   - Click "Create Pull Request"
   - Request review from team members
   - Wait for CI checks to pass

6. **Address review comments**
   - Make requested changes
   - Commit and push to the same branch
   - The PR updates automatically

7. **Merge**
   - Once approved, merge the PR
   - Delete the feature branch after merging

### Code Review Guidelines

When reviewing PRs:

- **Check functionality**: Does it work as intended?
- **Code quality**: Is the code clean and maintainable?
- **Performance**: Are there any performance concerns?
- **Security**: Any potential security issues?
- **Tests**: Are tests included and passing?

Use GitHub's review features:
- "Approve" - Ready to merge
- "Request changes" - Needs modifications
- "Comment" - Neutral feedback

### Handling Merge Conflicts

If you encounter conflicts:

1. **Fetch latest changes**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Resolve conflicts**
   - Open conflicting files
   - Look for `<<<<<<<`, `=======`, `>>>>>>>` markers
   - Edit to keep desired changes
   - Remove conflict markers

3. **Complete the rebase**
   ```bash
   git add .
   git rebase --continue
   ```

4. **Push changes**
   ```bash
   git push origin feature/your-feature-name --force-with-lease
   ```

### Best Practices

- **Pull frequently**: Sync with main branch often
- **Small commits**: Make focused, atomic commits
- **Clear messages**: Write descriptive commit messages
- **Test locally**: Always test before pushing
- **One feature per PR**: Keep PRs focused and reviewable
- **Update documentation**: Update docs if you change functionality
- **Be respectful**: Provide constructive feedback in reviews



