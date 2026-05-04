import jwt from "jsonwebtoken";

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL     = "15m";
const REFRESH_TTL    = "30d";

export interface AccessPayload { sub: string; type: "access" }
export interface RefreshPayload { sub: string; type: "refresh"; sid: string }

export const signAccess = (userId: string): string =>
  jwt.sign({ sub: userId, type: "access" } satisfies AccessPayload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });

export const signRefresh = (userId: string, sessionId: string): string =>
  jwt.sign({ sub: userId, type: "refresh", sid: sessionId } satisfies RefreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });

export const verifyAccess = (token: string): AccessPayload =>
  jwt.verify(token, ACCESS_SECRET) as AccessPayload;

export const verifyRefresh = (token: string): RefreshPayload =>
  jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
