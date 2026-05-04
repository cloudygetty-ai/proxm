import { useAppStore } from "../store/useAppStore.js";
import type { WsServerEvent, WsClientEvent } from "@proxm/types";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connect(token: string) {
  if (ws?.readyState === WebSocket.OPEN) return;

  const wsUrl = `${process.env.EXPO_PUBLIC_WS_URL}?token=${token}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[ws] connected");
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (e) => {
    let event: WsServerEvent;
    try { event = JSON.parse(e.data); } catch { return; }
    handleServerEvent(event);
  };

  ws.onclose = () => {
    console.log("[ws] closed — reconnecting in 3s");
    reconnectTimer = setTimeout(() => connect(token), 3000);
  };

  ws.onerror = (err) => console.error("[ws] error", err);
}

export function send(event: WsClientEvent) {
  if (ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(event));
}

export function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  ws?.close();
  ws = null;
}

function handleServerEvent(event: WsServerEvent) {
  const store = useAppStore.getState();

  switch (event.type) {
    case "location_update":
      store.setNearbyUsers(event.users);
      break;

    case "ping_received": {
      const from = store.nearbyUsers.find((u) => u.id === event.ping.fromUserId);
      if (from) {
        store.setIncomingPing({ pingId: event.ping.id, fromUser: from });
      }
      break;
    }

    case "ping_accepted":
      store.setActiveChannel(event.channel);
      store.setIncomingPing(null);
      break;

    case "ping_expired":
      store.clearPing();
      break;

    case "heat_update":
      store.setHeatZones(event.zones);
      break;

    case "ghost_confirmed":
      store.activateGhost();
      break;

    case "mash_trigger":
      // Trigger haptic + optional auto-action
      import("expo-haptics").then((Haptics) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      });
      break;
  }
}
