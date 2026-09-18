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

## How it works

![Informationsfluss von der LaMetric-Uhr über diesen Server zu Pi-hole: die Uhr pollt periodisch /lametric, ein TTL-Cache beantwortet die meisten Polls ohne Pi-hole zu kontaktieren, bei einem Cache-Miss holt der Server eine Pi-hole-Session und fragt drei Stats-Endpunkte parallel ab, und ein Fehlerpfad liefert veraltete Frames oder einen 502 zurück.](docs/dataflow.png)

Editable source: [`docs/dataflow.excalidraw`](docs/dataflow.excalidraw) (open at
[excalidraw.com](https://excalidraw.com)).

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

## Deploying an update

On the Pi, this repo is a git clone kept current by a shared `update.sh` in
its home directory (not part of this repository, alongside a few unrelated
projects on the same device). The manual equivalent, run from the clone:

    git pull --ff-only
    npm ci && npm run build
    sudo systemctl restart lametric

**`npm ci`, not `npm install`.** `npm install` rewrites the committed
`package-lock.json` in the installed npm version's own dialect (different
sorting, added/removed fields), leaving it locally modified even though
nothing in `package.json` changed. That once blocked the automated update
outright: the script refuses to pull a repo with local changes to tracked
files - it cannot distinguish harmless lockfile drift from a real conflict,
so it plays safe and skips the pull. `npm ci` installs exactly what the
lockfile says and never rewrites it.

**The restart is not optional.** The systemd unit (`lametric.service`) sets
`Restart=always`, which restarts the process after a crash, not after new
code lands - `dist/` is gitignored, built separately from the pull, and the
running process keeps the code it started with until something restarts it.

## Development

The source is TypeScript (`src/`, strict mode, ES modules, zero runtime
dependencies - Node's built-in `node:http` is all it needs).

```bash
npm run build         # compile to dist/
npm test              # Vitest suite with enforced coverage thresholds
npm run lint          # ESLint (typescript-eslint)
npm run prettier-check
```

## Requirements

- Node.js 18.x (CI targets this exact version - it's what the project runs
  on unattended, on a Raspberry Pi via systemd)
- Pi-hole Core v6 or later
- At least one LaMetric clock with the My Data DIY app
