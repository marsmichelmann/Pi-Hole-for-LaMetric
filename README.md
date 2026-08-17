# Pi-Hole Status for LaMetric

![Node.js CI](https://github.com/marsmichelmann/Pi-Hole-for-LaMetric/actions/workflows/node.js.yml/badge.svg)

Serves your [Pi-hole](https://pi-hole.net/) v6 stats as a small HTTP endpoint
that a LaMetric clock polls via the official
[My Data DIY](https://apps.lametric.com/apps/my_data_diy__with_no-code_possibilities_/8942)
app - no cloud relay involved, everything stays on your LAN.

Shows a percent-blocked progress bar plus scrolling frames for blocked/total
queries today, blocklist size, client count, and the top blocked domain -
an approximation of the original (now discontinued upstream)
[Pi-Hole Status](https://apps.lametric.com/apps/pi-hole_status/6943) app,
built on the generic My Data DIY frame format rather than a bespoke app.

```
LaMetric clock (My Data DIY, polls periodically)
        │  GET http://<this-host>:<Server.Port>/lametric
        ▼
this program (Node.js)
        │  Pi-hole v6 REST API, session login
        ▼
Pi-hole
```

## Setup

1. Requirements: Node.js ≥ 18, a running Pi-hole (Core v6+), and a LaMetric
   clock on the same network.
2. `npm ci && npm run build` (TypeScript, compiled to `dist/`)
3. `cp example.config.json config.json`, then fill in:
   - `PiHole.IP` - your Pi-hole's address.
   - `PiHole.Password` - your Pi-hole web UI password (or a dedicated
     [application password](https://docs.pi-hole.net/api/) - never commit
     the real value, `config.json` is gitignored).
   - `Server.Port` - the port this program listens on (default `3030`).
   - `Icons` (optional) - LaMetric icon IDs per frame, picked from
     [developer.lametric.com/icons](https://developer.lametric.com/icons).
     Keys: `percentBlocked`, `adsBlockedToday`, `dnsQueriesToday`,
     `blockListSize`, `totalClientsSeen`, `topBlockedQuery`,
     `lastBlockedQuery`.
   - `updateInterval` - seconds a poll response is cached before Pi-hole is
     asked again (also the TTL of the stale fallback on a failed refresh).
4. `npm start` (or `node dist/main.js`, e.g. from a systemd unit - **not**
   `npm start`/`npm run build` there: `typescript` is a devDependency, so a
   production-only `npm ci --omit=dev` install has no compiler to run)
5. On your phone, add the **My Data DIY** app to your LaMetric clock and
   configure its poll URL as `http://<this-host>:<Server.Port>/lametric`.

## Development

The source is TypeScript (`src/`, strict mode, ES modules, zero runtime
dependencies - Node's built-in `fetch` and `http` are all it needs).

```bash
npm run build         # compile to dist/
npm test              # Vitest suite with enforced coverage thresholds
npm run lint          # ESLint (typescript-eslint)
npm run prettier-check
```

## Requirements

- Node.js ≥ 18 (tested against 18.x, 20.x, 22.x in CI; this is what the
  project runs on unattended, e.g. a Raspberry Pi via systemd)
- Pi-hole Core v6 or later
- At least one LaMetric clock with the My Data DIY app
