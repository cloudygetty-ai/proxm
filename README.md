# PROXM

> **Deploy. Don't browse.**

Tactical proximity dating HUD. Real-time location grid, 60-second ping/pull protocol, 30-second live audio channels, MASH trigger scripting, and a Ghost kill switch.

---

## Stack

| Layer | Tech |
|---|---|
| API | Node 20, Express, WebSocket (ws), Prisma, PostgreSQL/PostGIS |
| Cache | Redis (GEORADIUS proximity, heat zones, OTP, cooldowns) |
| Realtime | WebSocket + LiveKit WebRTC |
| Mobile | Expo 51, React Native, Zustand, expo-location |
| Web | Vite, React, Mapbox GL |
| Monorepo | Yarn Workspaces, Turborepo |
| Deploy | Railway (API), Vercel (Web), EAS (Mobile) |

## Quick Start

```bash
# Infra
docker-compose -f infra/docker/docker-compose.yml up -d

# Install
yarn install

# DB
yarn db:push

# Dev
yarn dev:api   # port 4000 (HTTP) + 4001 (WS)
yarn dev:web   # port 3000
yarn dev:mobile
```

## Feature Map

- **Live-Wire Map** — 30s position refresh, Redis GEORADIUS proximity
- **Heat Zones** — PostGIS density grid, 30s cache, radial pulse overlay
- **Flash Profile** — 1 photo, 3 action tags, vibe ticker
- **Ping & Pull** — 60s mutual ping, 30s LiveKit audio channel
- **MASH Triggers** — If/Then proximity + tag rules, server-side eval
- **Ghost Mode** — Double-tap kill switch, immediate location broadcast stop
- **Face Verify** — Camera liveness check, `verifiedAt` timestamp

## Repo

`cloudygetty-ai/proxm`
