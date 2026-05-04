import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LK_HOST    = process.env.LIVEKIT_HOST!;
const LK_KEY     = process.env.LIVEKIT_API_KEY!;
const LK_SECRET  = process.env.LIVEKIT_API_SECRET!;

const roomService = new RoomServiceClient(LK_HOST, LK_KEY, LK_SECRET);

export async function createLiveKitRoom(pingId: string, destroy = false): Promise<string> {
  const roomName = `proxm-ping-${pingId}`;
  if (destroy) {
    await roomService.deleteRoom(roomName).catch(() => null);
    return roomName;
  }
  await roomService.createRoom({ name: roomName, emptyTimeout: 30, maxParticipants: 2 });
  return roomName;
}

export function generateLiveKitToken(userId: string, roomName: string): string {
  const at = new AccessToken(LK_KEY, LK_SECRET, { identity: userId, ttl: 60 });
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
  return at.toJwt();
}
