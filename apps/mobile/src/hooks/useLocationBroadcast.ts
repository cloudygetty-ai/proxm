import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../store/useAppStore.js";
import { send } from "../services/websocket.js";

const BROADCAST_INTERVAL_MS = 10_000; // 10s (server snaps to 30s grid)

export function useLocationBroadcast() {
  const { ghostMode, setLocation } = useAppStore();
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  useEffect(() => {
    if (ghostMode) {
      stop();
      return;
    }
    start();
    return () => stop();
  }, [ghostMode]);

  async function start() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (loc) => {
        lastLocRef.current = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 10,
        };
        setLocation(loc.coords.latitude, loc.coords.longitude);
      }
    );

    timerRef.current = setInterval(() => {
      const loc = lastLocRef.current;
      if (!loc) return;
      send({ type: "location_broadcast", ...loc });
    }, BROADCAST_INTERVAL_MS);
  }

  function stop() {
    subRef.current?.remove();
    subRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    send({ type: "location_stop" });
  }
}
