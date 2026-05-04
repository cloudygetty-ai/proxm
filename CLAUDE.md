# PROXM — Sentinel Engine v5.0
> Tactical proximity dating platform. Deploy. Don't browse.

## PRIME DIRECTIVE
Maximum Leverage, Minimum Surface Area.
Every change must earn its place. No footprint expansion without 2× gain in resilience, clarity, or capability.

## ARCHITECTURE

```
proxm/
├── apps/
│   ├── api/          — Express + WebSocket + Prisma (Node 20)
│   ├── mobile/       — Expo / React Native (iOS + Android)
│   └── web/          — Vite / React (admin + web client)
├── packages/
│   ├── types/        — Shared TypeScript contracts (source of truth)
│   ├── ui/           — Shared RN + web components
│   ├── shared/       — Business logic shared across apps
│   └── config/       — ESLint, TSConfig, shared configs
└── infra/
    ├── docker/       — Local dev compose (Postgres/PostGIS + Redis)
    ├── nginx/        — Reverse proxy config
    └── k8s/          — Kubernetes manifests (production)
```

## CORE FEATURES

| Feature | Transport | Latency Target |
|---|---|---|
| Location broadcast | WebSocket | < 500ms |
| Ping / mutual ping | WebSocket | < 200ms |
| Audio channel | LiveKit WebRTC | < 100ms |
| Heat zones | Redis cache | 30s TTL |
| MASH triggers | Server-side eval | < 100ms |
| Ghost mode | WS + DB | immediate |

## DATA CONTRACTS
All types in `packages/types/src/index.ts`. Never duplicate. Import from `@proxm/types`.

## WEBSOCKET PROTOCOL
- Client → Server: `WsClientEvent` union
- Server → Client: `WsServerEvent` union
- Auth: `?token=<accessToken>` on connect
- Reconnect: exponential backoff, max 30s

## LOCATION PIPELINE
```
Mobile GPS (10s poll)
  → WS location_broadcast
  → Redis GEORADIUS (1.6km, 100 users max)
  → Nearby UserPublic[] computed
  → MASH triggers evaluated
  → broadcast location_update to all nearby
  → 30s cron snaps heat zones
```

## PING LIFECYCLE
```
User A sends ping → 60s TTL timer starts
  → User B receives ping_received event
  → B responds (accept/reject) within 60s
  → If accept: LiveKit room created (30s max)
  → Both users receive ping_accepted + channelId
  → Both join LiveKit room for 30s audio
  → Room auto-destroyed at 30s
  → 5min cooldown: A cannot ping B again
```

## METACOGNITIVE GATES (run before every PR)
1. PREDICTOR — what breaks if this fails?
2. PESSIMIST — null state, race condition, offline recovery
3. MINIMALIST — is this a config change vs logic change?

## ENV VARS
See `apps/api/.env.example`. Never commit secrets.

## DEV SETUP
```bash
# 1. Start infra
docker-compose -f infra/docker/docker-compose.yml up -d

# 2. Install deps
yarn install

# 3. Push schema
yarn db:push

# 4. Start API
yarn dev:api

# 5. Start web
yarn dev:web

# 6. Start mobile
yarn dev:mobile
```

## DEPLOYMENT
- API: Railway (Docker)
- Web: Vercel
- Mobile: EAS Build → TestFlight / Play Store
- DB: Railway Postgres (PostGIS)
- Redis: Railway Redis
- LiveKit: LiveKit Cloud
- Media: AWS S3 + CloudFront CDN
