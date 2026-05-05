import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Platform, Modal,
} from "react-native";
import { CameraView, useCameraPermissions, Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../../store/useAppStore";

const C = {
  void: "#000", surface: "#080808", border: "#181818",
  ghost: "#666", text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", electric: "#00aaff", amber: "#ff7700",
};

type Phase = "intro" | "scanning" | "processing" | "success" | "failed";

function ScanFrame({ phase }: { phase: Phase }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "scanning") return;
    // corner pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    // scan line sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, [phase]);

  const borderColor = phase === "success" ? C.electric
    : phase === "failed" ? C.crimson
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.crimson] });

  const scanTranslate = scanLine.interpolate({
    inputRange: [0, 1], outputRange: [-120, 120],
  });

  return (
    <View style={styles.frameOuter}>
      {/* corner brackets */}
      {[
        { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
        { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
        { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
        { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
      ].map((pos, i) => (
        <Animated.View
          key={i}
          style={[styles.corner, pos, { borderColor }]}
        />
      ))}

      {/* scan line */}
      {phase === "scanning" && (
        <Animated.View style={[
          styles.scanLine,
          { transform: [{ translateY: scanTranslate }] },
        ]} />
      )}

      {/* success / fail overlay */}
      {phase === "success" && (
        <View style={styles.resultOverlay}>
          <Text style={[styles.resultIcon, { color: C.electric }]}>✓</Text>
        </View>
      )}
      {phase === "failed" && (
        <View style={styles.resultOverlay}>
          <Text style={[styles.resultIcon, { color: C.crimson }]}>✗</Text>
        </View>
      )}
    </View>
  );
}

export function FaceVerifyScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("intro");
  const [dots, setDots] = useState("");
  const cameraRef = useRef<CameraView>(null);
  const { accessToken, profile } = useAppStore();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // animated dots for processing label
  useEffect(() => {
    if (phase !== "processing") return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "·"), 400);
    return () => clearInterval(id);
  }, [phase]);

  const startScan = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setPhase("scanning");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // simulate liveness check after 2.5s
    setTimeout(async () => {
      setPhase("processing");
      try {
        // capture frame
        const photo = await cameraRef.current?.takePictureAsync({
          quality: 0.6, base64: true, skipProcessing: true,
        });

        // POST to verify endpoint
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/users/me/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageBase64: photo?.base64 }),
        });

        // Simulate success for prototype
        setTimeout(() => {
          setPhase("success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => navigation.goBack(), 1800);
        }, 1200);
      } catch {
        setPhase("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setPhase("intro"), 2000);
      }
    }, 2500);
  };

  const phaseLabel: Record<Phase, string> = {
    intro:      "POSITION YOUR FACE IN THE FRAME",
    scanning:   "HOLD STILL · SCANNING",
    processing: `PROCESSING${dots}`,
    success:    "FACE VERIFIED · BADGE ACTIVE",
    failed:     "SCAN FAILED · TRY AGAIN",
  };

  const phaseColor: Record<Phase, string> = {
    intro: C.ghost, scanning: C.text,
    processing: C.amber, success: C.electric, failed: C.crimson,
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      {/* camera feed */}
      {(phase !== "intro") && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0808" }]} />
      )}

      {/* dark vignette */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* top bar */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>PROXM</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* scan frame */}
      <View style={styles.frameArea}>
        <ScanFrame phase={phase} />
      </View>

      {/* status label */}
      <Text style={[styles.statusLabel, { color: phaseColor[phase] }]}>
        {phaseLabel[phase]}
      </Text>

      {/* bottom section */}
      <View style={styles.bottom}>
        {phase === "intro" && (
          <>
            <Text style={styles.intro}>
              Face verification confirms you're real.{"\n"}
              Valid for 1 hour · shown as ✓ on your pin.
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startScan}>
              <Text style={styles.startBtnText}>START SCAN</Text>
            </TouchableOpacity>
          </>
        )}
        {phase === "failed" && (
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: C.crimson }]} onPress={() => setPhase("intro")}>
            <Text style={styles.startBtnText}>RETRY</Text>
          </TouchableOpacity>
        )}
        {(phase === "scanning" || phase === "processing") && (
          <Text style={styles.liveness}>
            {phase === "scanning" ? "Look directly at the camera" : "Analyzing biometrics"}
          </Text>
        )}
        {phase === "success" && (
          <Text style={[styles.liveness, { color: C.electric }]}>
            Your ✓ badge is now active on the map
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
    backgroundColor: "transparent",
  },
  topBar: {
    position: "absolute", top: Platform.OS === "ios" ? 54 : 32,
    left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, zIndex: 10,
  },
  wordmark: { fontFamily: "BebasNeue_400Regular", fontSize: 28, color: C.bright, letterSpacing: 8 },
  closeBtn: { padding: 8 },
  closeText: { color: C.ghost, fontSize: 18 },
  frameArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  frameOuter: {
    width: 240, height: 280, position: "relative",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  corner: { position: "absolute", width: 24, height: 24 },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 1,
    backgroundColor: C.crimson, opacity: 0.8,
    shadowColor: C.crimson, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  resultOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  resultIcon: { fontSize: 64, fontWeight: "700" },
  statusLabel: {
    textAlign: "center", fontSize: 9, letterSpacing: 3,
    fontFamily: "SpaceMono_400Regular", marginBottom: 32, paddingHorizontal: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
    alignItems: "center",
  },
  intro: {
    color: C.ghost, fontSize: 11, letterSpacing: 1, textAlign: "center",
    fontFamily: "SpaceMono_400Regular", lineHeight: 20, marginBottom: 32,
  },
  startBtn: {
    width: "100%", paddingVertical: 20, backgroundColor: C.crimson, alignItems: "center",
    shadowColor: C.crimson, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  startBtnText: { color: C.bright, fontSize: 12, letterSpacing: 5, fontFamily: "SpaceMono_700Bold" },
  liveness: {
    color: C.ghost, fontSize: 10, letterSpacing: 2,
    fontFamily: "SpaceMono_400Regular", textAlign: "center",
  },
});
