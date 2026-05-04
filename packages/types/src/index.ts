// ─── PROXM SHARED TYPES ───────────────────────────────────────────────────────
// Single source of truth for all data contracts across API, mobile, web

// ── User ─────────────────────────────────────────────────────────────────────
export type ActionTag = `#${string}`;

export interface UserProfile {
  id: string;
  displayName: string;
  photo: string; // signed CDN URL
  actionTags: [ActionTag, ActionTag, ActionTag]; // exactly 3
  vibe?: string; // Spotify track string | Unreal Engine tag
  verifiedAt?: Date; // face-verified timestamp
  readyNow: boolean;
  createdAt: Date;
}

export interface UserLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number; // meters
  capturedAt: Date;
  broadcasting: boolean;
}

export interface UserPublic {
  id: string;
  displayName: string;
  photo: string;
  actionTags: [ActionTag, ActionTag, ActionTag];
  vibe?: string;
  verified: boolean;
  readyNow: boolean;
  distanceMeters: number;
  bearing: number; // degrees 0-360 from viewer
  lat?: number; // only in FastMode
  lng?: number;
}

// ── Ping ─────────────────────────────────────────────────────────────────────
export type PingStatus = "pending" | "accepted" | "expired" | "rejected";

export interface Ping {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: PingStatus;
  sentAt: Date;
  expiresAt: Date; // sentAt + 60s
  respondedAt?: Date;
}

export interface PingMutual {
  pingId: string;
  channelId: string; // LiveKit room ID
  expiresAt: Date; // sentAt + 30s audio window
}

// ── MASH Trigger ─────────────────────────────────────────────────────────────
export interface MashTrigger {
  id: string;
  userId: string;
  name: string;
  condition: MashCondition;
  action: MashAction;
  enabled: boolean;
  createdAt: Date;
}

export interface MashCondition {
  type: "proximity" | "tag_match" | "verified_only";
  radiusMeters?: number;
  tags?: ActionTag[];
}

export interface MashAction {
  type: "vibrate" | "notify" | "auto_ping" | "show_vector";
  vibrationPattern?: number[]; // ms on/off sequence
  notificationTitle?: string;
}

// ── Heat Zone ────────────────────────────────────────────────────────────────
export interface HeatZone {
  lat: number;
  lng: number;
  radiusMeters: number;
  density: number; // 0-1
  readyNowCount: number;
}

// ── WebSocket Events ─────────────────────────────────────────────────────────
export type WsServerEvent =
  | { type: "location_update"; users: UserPublic[] }
  | { type: "ping_received"; ping: Ping }
  | { type: "ping_accepted"; channel: PingMutual }
  | { type: "ping_expired"; pingId: string }
  | { type: "heat_update"; zones: HeatZone[] }
  | { type: "mash_trigger"; triggerId: string; matchedUser: UserPublic }
  | { type: "ghost_confirmed" };

export type WsClientEvent =
  | { type: "location_broadcast"; lat: number; lng: number; accuracy: number }
  | { type: "location_stop" }
  | { type: "ping_send"; toUserId: string }
  | { type: "ping_respond"; pingId: string; accept: boolean }
  | { type: "mash_sync"; triggers: MashTrigger[] }
  | { type: "ghost_activate" };

// ── API Response wrapper ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  ts: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface Session {
  userId: string;
  profile: UserProfile;
  tokens: AuthTokens;
}
