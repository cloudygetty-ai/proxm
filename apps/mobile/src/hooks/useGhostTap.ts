import { useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../store/useAppStore.js";
import { send } from "../services/websocket.js";

/**
 * Double-tap kill switch. Call onTap() on each tap of the ghost zone.
 * Two taps within 400ms triggers ghost mode.
 */
export function useGhostTap() {
  const tapCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activateGhost, ghostMode, deactivateGhost } = useAppStore();

  const onTap = useCallback(() => {
    if (ghostMode) {
      deactivateGhost();
      return;
    }

    tapCount.current += 1;
    if (timer.current) clearTimeout(timer.current);

    if (tapCount.current >= 2) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      send({ type: "ghost_activate" });
      activateGhost();
    } else {
      timer.current = setTimeout(() => { tapCount.current = 0; }, 400);
    }
  }, [ghostMode]);

  return { onTap, ghostMode };
}
