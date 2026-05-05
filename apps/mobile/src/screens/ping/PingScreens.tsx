import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Platform, Vibration, Modal,
} from "react-native";
import { LiveKitRoom, AudioSession } from "@livekit/react-native";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../../store/useAppStore";
import { send } from "../../services/websocket";

const C = {
  void: "#000", surface: "#080808", border: "#181818",
  muted: "#333", ghost: "#666", text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.15)",
  electric: "#00aaff",
};

// ── Ripple ring component ─────────────────────────────────────────────────────
function RippleRing({ delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.timing(scale,   { toValue: 2.4, duration: 1800, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 1800, delay, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[
      styles.ripple,
      { transform: [{ scale }], opacity },
    ]} />
  );
}

// ── Incoming ping modal ───────────────────────────────────────────────────────
export function IncomingPingModal() {
  const { incomingPing, nearbyUsers, setIncomingPing, setActiveChannel } = useAppStore();
  const [timer, setTimer] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideY = useRef(new Animated.Value(600)).current;

  const fromUser = nearbyUsers.find(u => u.id === incomingPing?.fromUser?.id) ?? incomingPing?.fromUser;

  useEffect(() => {
    if (!incomingPing) return;

    // Haptic pattern — two heavy pulses
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);

    setTimer(60);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();

    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { dismiss(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [incomingPing?.pingId]);

  const dismiss = () => {
    Animated.timing(slideY, { toValue: 600, duration: 300, useNativeDriver: true }).start(() => {
      setIncomingPing(null);
    });
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const accept = () => {
    if (!incomingPing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    send({ type: "ping_respond", pingId: incomingPing.pingId, accept: true });
    dismiss();
  };

  const reject = () => {
    if (!incomingPing) return;
    send({ type: "ping_respond", pingId: incomingPing.pingId, accept: false });
    dismiss();
  };

  if (!incomingPing || !fromUser) return null;

  const timerPct = timer / 60;

  return (
    <Modal transparent animationType="none" visible={!!incomingPing}>
      <View style={styles.pingOverlay}>
        <Animated.View style={[styles.pingSheet, { transform: [{ translateY: slideY }] }]}>
          {/* timer arc indicator */}
          <View style={styles.timerRow}>
            <View style={styles.timerBarTrack}>
              <View style={[styles.timerBarFill, { width: `${timerPct * 100}%` as any }]} />
            </View>
            <Text style={styles.timerText}>{timer}s</Text>
          </View>

          <Text style={styles.pingLabel}>INCOMING PING</Text>

          {/* Ripple + avatar */}
          <View style={styles.avatarWrap}>
            <RippleRing delay={0} />
            <RippleRing delay={600} />
            <RippleRing delay={1200} />
            <View style={styles.pingAvatar}>
              <Text style={styles.pingAvatarText}>
                {fromUser.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.pingName}>{fromUser.displayName}</Text>

          <View style={styles.pingTagRow}>
            {fromUser.actionTags.map(t => (
              <View key={t} style={styles.pingTag}>
                <Text style={styles.pingTagText}>{t}</Text>
              </View>
            ))}
          </View>

          {fromUser.distanceMeters < 1000 ? (
            <Text style={styles.pingDist}>{Math.round(fromUser.distanceMeters)}m away</Text>
          ) : (
            <Text style={styles.pingDist}>{(fromUser.distanceMeters / 1000).toFixed(1)}km away</Text>
          )}

          {/* Accept / Reject */}
          <View style={styles.pingActions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={reject}>
              <Text style={styles.rejectText}>PASS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={accept}>
              <Text style={styles.acceptText}>PING BACK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Audio channel screen ──────────────────────────────────────────────────────
export function AudioChannelModal() {
  const { activeChannel, clearPing, accessToken } = useAppStore();
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const barHeights = useRef(Array(18).fill(0).map(() => new Animated.Value(8))).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!activeChannel) return;

    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Fetch LiveKit token
    fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/pings/${activeChannel.pingId}/token`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(j => j.ok && setLivekitToken(j.data.token))
      .catch(console.error);

    // Countdown
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearPing(); return 0; }
        return s - 1;
      });
    }, 1000);

    // Audio waveform animation
    const animateBars = () => {
      const anims = barHeights.map(bar =>
        Animated.timing(bar, {
          toValue: Math.random() * 48 + 8,
          duration: 80 + Math.random() * 80,
          useNativeDriver: false,
        })
      );
      Animated.parallel(anims).start(() => { if (activeChannel) animateBars(); });
    };
    animateBars();

    return () => clearInterval(id);
  }, [activeChannel?.channelId]);

  if (!activeChannel) return null;

  return (
    <Modal transparent animationType="none" visible={!!activeChannel}>
      <Animated.View style={[styles.audioOverlay, { opacity: fadeIn }]}>
        <Text style={styles.audioLabel}>LIVE AUDIO CHANNEL</Text>
        <Text style={styles.audioTimer}>{secondsLeft}</Text>
        <Text style={styles.audioTimerSub}>seconds remaining</Text>

        {/* Waveform */}
        <View style={styles.waveform}>
          {barHeights.map((h, i) => (
            <Animated.View
              key={i}
              style={[styles.waveBar, { height: h }]}
            />
          ))}
        </View>

        <Text style={styles.audioNote}>
          Talk fast. Channel closes automatically.
        </Text>

        <TouchableOpacity style={styles.endBtn} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          clearPing();
        }}>
          <Text style={styles.endBtnText}>END CHANNEL</Text>
        </TouchableOpacity>

        {/* LiveKit room (audio only) */}
        {livekitToken && (
          <LiveKitRoom
            serverUrl={process.env.EXPO_PUBLIC_LIVEKIT_URL ?? ""}
            token={livekitToken}
            connect={true}
            audio={true}
            video={false}
            onConnected={() => setConnected(true)}
            onDisconnected={clearPing}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Incoming ping
  pingOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "flex-end",
  },
  pingSheet: {
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.crimson,
    paddingHorizontal: 24, paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    alignItems: "center",
  },
  timerRow: {
    width: "100%", flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 24,
  },
  timerBarTrack: {
    flex: 1, height: 2, backgroundColor: C.border,
  },
  timerBarFill: {
    height: "100%", backgroundColor: C.crimson,
  },
  timerText: {
    fontSize: 11, color: C.crimson, fontFamily: "SpaceMono_700Bold",
    letterSpacing: 2, width: 32, textAlign: "right",
  },
  pingLabel: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 32,
    textTransform: "uppercase",
  },
  avatarWrap: {
    width: 100, height: 100, alignItems: "center",
    justifyContent: "center", marginBottom: 24, position: "relative",
  },
  ripple: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5, borderColor: C.crimson,
  },
  pingAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.crimsonLo, borderWidth: 2, borderColor: C.crimson,
    alignItems: "center", justifyContent: "center",
  },
  pingAvatarText: {
    fontSize: 32, color: C.bright, fontFamily: "BebasNeue_400Regular",
  },
  pingName: {
    fontSize: 36, color: C.bright, fontFamily: "BebasNeue_400Regular",
    letterSpacing: 2, marginBottom: 12,
  },
  pingTagRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  pingTag: {
    borderWidth: 1, borderColor: C.electric,
    backgroundColor: "rgba(0,170,255,0.1)",
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pingTagText: { color: C.electric, fontSize: 10, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  pingDist: { color: C.ghost, fontSize: 10, letterSpacing: 2, marginBottom: 32, fontFamily: "SpaceMono_400Regular" },
  pingActions: { flexDirection: "row", gap: 10, width: "100%" },
  rejectBtn: {
    flex: 1, paddingVertical: 18,
    borderWidth: 1, borderColor: C.muted,
    alignItems: "center",
  },
  rejectText: { color: C.ghost, fontSize: 11, letterSpacing: 4, fontFamily: "SpaceMono_700Bold" },
  acceptBtn: {
    flex: 2, paddingVertical: 18,
    backgroundColor: C.crimson,
    alignItems: "center",
    shadowColor: C.crimson, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  acceptText: { color: C.bright, fontSize: 12, letterSpacing: 4, fontFamily: "SpaceMono_700Bold" },

  // Audio channel
  audioOverlay: {
    flex: 1, backgroundColor: C.void,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32,
  },
  audioLabel: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 16,
  },
  audioTimer: {
    fontSize: 80, color: C.crimson, fontFamily: "SpaceMono_700Bold",
    lineHeight: 80,
    textShadowColor: C.crimson, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  audioTimerSub: {
    fontSize: 9, letterSpacing: 3, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 48,
  },
  waveform: {
    flexDirection: "row", alignItems: "center",
    gap: 4, height: 60, marginBottom: 48,
  },
  waveBar: {
    width: 4, borderRadius: 2, backgroundColor: C.crimson,
    shadowColor: C.crimson, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  audioNote: {
    fontSize: 9, letterSpacing: 2, color: C.muted,
    fontFamily: "SpaceMono_400Regular", marginBottom: 40, textAlign: "center",
  },
  endBtn: {
    paddingHorizontal: 48, paddingVertical: 18,
    backgroundColor: C.crimson,
  },
  endBtnText: { color: C.bright, fontSize: 11, letterSpacing: 5, fontFamily: "SpaceMono_700Bold" },
});
