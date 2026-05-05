import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from "react-native";
import { useAppStore } from "../store/useAppStore";
import { useGhostTap } from "../hooks/useGhostTap";

export function GhostOverlay() {
  const { deactivateGhost } = useAppStore();
  const { onTap } = useGhostTap();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Text style={styles.battery}>🔋</Text>
      <Text style={styles.pct}>10%</Text>
      <Text style={styles.sub}>LOW BATTERY · LOCATION OFF</Text>
      <TouchableOpacity style={styles.resumeBtn} onPress={onTap}>
        <Text style={styles.resumeText}>RESUME</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject, zIndex: 9999,
    backgroundColor: "#000", alignItems: "center", justifyContent: "center",
  },
  battery: { fontSize: 72, marginBottom: 16 },
  pct: {
    fontSize: 48, color: "#fff", fontFamily: "BebasNeue_400Regular",
    letterSpacing: 4, marginBottom: 8,
  },
  sub: {
    fontSize: 9, letterSpacing: 3, color: "#333",
    fontFamily: "SpaceMono_400Regular", marginBottom: 64,
  },
  resumeBtn: {
    borderWidth: 1, borderColor: "#222",
    paddingHorizontal: 32, paddingVertical: 12,
  },
  resumeText: {
    fontSize: 9, letterSpacing: 4, color: "#444",
    fontFamily: "SpaceMono_400Regular",
  },
});
