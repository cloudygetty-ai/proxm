import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

export const db = global.__db ?? new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "warn", "error"]
    : ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") {
  global.__db = db;
}
