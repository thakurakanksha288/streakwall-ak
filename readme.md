<div align="center">

# 🎨 Streak Wall

### A daily pixel wall your whole community paints together — one tile at a time.

Built on Reddit's [Devvit Web](https://developers.reddit.com) for the **Games with a Hook Hackathon**

[![TypeScript](https://img.shields.io/badge/TypeScript-82.8%25-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Devvit](https://img.shields.io/badge/Built%20on-Devvit%20Web-FF4500?logo=reddit&logoColor=white)](https://developers.reddit.com)
[![Redis](https://img.shields.io/badge/State-Redis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![esbuild](https://img.shields.io/badge/Bundled%20with-esbuild-FFCF00?logo=esbuild&logoColor=black)](https://esbuild.github.io)
[![License](https://img.shields.io/badge/License-see%20LICENSE-blue)](./LICENSE)

</div>

---

<p align="center">
  <img src="docs/screenshots/splash-card.png" width="49%" alt="Streak Wall splash card in the Reddit feed" />
  <img src="docs/screenshots/game-screen.png" width="49%" alt="Streak Wall game screen with palette, XP bar, and live activity" />
</p>

---

## 🌅 What is Streak Wall?

Every day, your subreddit wakes up to a **blank pixel grid** and a community-voted theme — *"a bird,"* *"your dream weekend,"* *"a tiny creature nobody has met yet."* Each redditor gets a handful of tiles to paint, chosen from a shared palette. Together, tile by tile, the community builds one piece of collaborative pixel art.

But the wall doesn't just sit there. **It has to be kept alive.**

> If the community goes quiet, painted tiles slowly fade back to gray. The wall's vibrancy on any given day is a living signal of how active your community actually is.

That single idea — *a shared thing that needs you to come back* — is the whole design philosophy behind Streak Wall.

## 🪝 The Hook

This isn't one mechanic, it's five, reinforcing each other:

| Mechanic | Why it hooks |
|---|---|
| 🎨 **Daily tile limit** | Everyone gets a few tiles a day — enough to feel generous, not so many it feels like a chore |
| ⏳ **15-minute tile drip** | Run out? One new tile drips in every 15 minutes (up to a small stack) — a reason to check back *throughout* the day, not just once |
| 🌫️ **Tile decay** | Painted tiles fade if the wall goes quiet for too long — your contribution isn't permanent unless the community keeps it alive |
| 🔥 **Streaks & badges** | Consecutive days painting earns **First Stroke**, **10-Day**, **25-Day**, and **100-Day Streak** badges — visible identity for showing up |
| 🗳️ **Community prompt voting** | Anyone can suggest tomorrow's theme; the top-voted idea wins — the community owns what it's building, not just how it builds it |

Plus: an **XP & leveling system**, a **live activity feed**, a **leaderboard**, a **wildcard color mixer** for custom shades, and a **dark/light theme toggle** — all wrapped around the core loop.

## 🖼️ Today's Vibe

Each day's grid has a hidden target shape overlaid on it — a small pattern the community can paint *toward*. Hitting a target tile earns bonus XP; finishing the whole shape earns a big community-wide bonus. Because tiles decay, the shape has to be *maintained*, not just completed once.

Patterns scale with progress: small hand-designed icons at low tile counts, growing into procedurally generated mosaics as levels rise — so the challenge never runs out of room to grow.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Platform | [Devvit Web](https://developers.reddit.com) (Reddit's interactive posts platform) |
| Client | Vanilla TypeScript, compiled by [esbuild](https://esbuild.github.io), rendered on HTML5 `<canvas>` — no game engine |
| Server | Node's raw `http` module via `@devvit/web/server`, fully bundled (no `node_modules` at runtime) |
| State | [Redis](https://redis.io) — mosaics, XP, streaks, badges, leaderboard, live activity |
| Tooling | [Biome](https://biomejs.dev) (lint + format), TypeScript project references, Node's built-in test runner |

## 📁 Project Structure

```
streakwall-ak/
├─ devvit.json          # App config: entrypoints, menu action, scheduler
├─ package.json         # esbuild scripts for client + server
├─ src/
│  ├─ shared/api.ts     # Types, constants, endpoint map — the client/server contract
│  ├─ server/
│  │  ├─ index.ts       # Server entrypoint (createServer + getServerPort)
│  │  ├─ server.ts      # HTTP router — every API endpoint
│  │  └─ db.ts          # All Redis operations
│  └─ client/
│     ├─ splash.ts      # Feed preview card: pixel tree background + live stats
│     └─ game.ts        # Full game: canvas, palette, tabs, badges, leaderboard
└─ public/
   ├─ splash.html
   └─ game.html          # Includes CSS custom properties for dark/light theme
```

## 🚀 Getting Started

> Requires **Node 22+**

```bash
npm create devvit@latest --template=bare
```

Then, from inside the project:

| Command | What it does |
|---|---|
| `npm run playtest` | Watches for changes, builds, uploads, and installs on Reddit (accepts a subreddit) |
| `npm run build` | Builds client + server, with esbuild metafiles |
| `npm run test` | Type-checks, lints, unit-tests, and builds — the full gate before shipping |
| `npm run clean` | Removes build outputs |
| `npm run format` | Fixes lint + formatting issues |
| `npm run publish` | Cleans, builds, uploads, and files a new app review request |

## 🏆 Built for Reddit's Games with a Hook Hackathon

Streak Wall is designed to score across three judging angles at once:

- **Hook** — a genuine, mechanically-reinforced reason to return daily *and* intraday
- **Retention Mechanics** — decay, streak badges, XP leveling, and the tile drip system
- **User Contributions** — community-voted themes and a shared collaborative canvas

## 📜 License

See [LICENSE](./LICENSE).

---

<div align="center">

*Paint a few tiles. Come back later. Keep the wall alive.*

</div>
