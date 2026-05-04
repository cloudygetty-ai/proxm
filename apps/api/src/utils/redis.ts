import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("[redis] error:", err.message);
});

// Key namespacing
export const keys = {
  userLocation: (uid: string) => `proxm:loc:${uid}`,
  userOnline:   (uid: string) => `proxm:online:${uid}`,
  heatZones:    () => "proxm:heat:zones",
  pingCooldown: (from: string, to: string) => `proxm:ping:cd:${from}:${to}`,
  wsConn:       (uid: string) => `proxm:ws:${uid}`,
  verifyNonce:  (uid: string) => `proxm:verify:${uid}`,
};
