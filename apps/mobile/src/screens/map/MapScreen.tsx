import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Platform, StatusBar, PanResponder,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../../store/useAppStore";
import { useLocationBroadcast } from "../../hooks/useLocationBroadcast";
import { useGhostTap } from "../../hooks/useGhostTap";
import { send } from "../../services/websocket";
import type { UserPublic } from "@proxm/types";

const { width: W, height: H } = Dimensions.get("window");

const C = {
  void: "#000000", surface: "#080808", border: "#181818",
  muted: "#333", ghost: "#666", text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.15)",
  electric: "#00aaff", electricLo: "rgba(0,170,255,0.12)",
  amber: "#ff7700",
};

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ── Heat zone layer source ────────────────────────────────────────────────────
function buildHeatGeoJSON(zones) {
  return {
    type: "FeatureCollection",
    features: zones.map((z, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [z.lng, z.lat] },
      properties: { density: z.density, readyNow: z.readyNowCount },
    })),
  };
}

// ── Vector line GeoJSON ───────────────────────────────────────────────────────
function buildVectorGeoJSON(myLng, myLat, targetLng, targetLat) {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[myLng, myLat], [targetLng, targetLat]],
      },
      properties: {},
    }],
  };
}

// ── User pin component ────────────────────────────────────────────────────────
function UserPin({ user, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, tension: 200 }).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }).start();
    }
  }, [selected]);

  return (
    <MapboxGL.MarkerView
      coordinate={[user.lng ?? 0, user.lat ?? 0]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <TouchableOpacity onPress={() => onPress(user)} activeOpacity={0.85}>
        <Animated.View style={[
          styles.pin,
          user.readyNow && styles.pinReady,
          selected && styles.pinSelected,
          { transform: [{ scale }] },
        ]}>
          <Text style={styles.pinText}>
            {user.displayName.charAt(0).toUpperCase()}
          </Text>
          {user.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          )}
        </Animated.View>
        {/* ready-now pulse ring */}
        {user.readyNow && (
          <View style={styles.pinRing} pointerEvents="none" />
        )}
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  );
}

// ── Profile bottom sheet ──────────────────────────────────────────────────────
function ProfileSheet({ user, onClose, onPing, onVector, pingState }) {
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: user ? 0 : 300,
      useNativeDriver: true, tension: 120, friction: 14,
    }).start();
  }, [user]);

  if (!user) return null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetRow}>
        {/* avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.displayName.charAt(0)}</Text>
        </View>
        {/* info */}
        <View style={styles.sheetInfo}>
          <Text style={styles.sheetName}>{user.displayName}</Text>
          <View style={styles.badgeRow}>
            {user.readyNow && (
              <View style={[styles.badge, { borderColor: C.crimson }]}>
                <Text style={[styles.badgeText, { color: C.crimson }]}>READY NOW</Text>
              </View>
            )}
            {user.verified && (
              <View style={[styles.badge, { borderColor: C.electric }]}>
                <Text style={[styles.badgeText, { color: C.electric }]}>VERIFIED</Text>
              </View>
            )}
            <Text style={styles.distText}>
              {user.distanceMeters < 1000
                ? `${Math.round(user.distanceMeters)}m`
                : `${(user.distanceMeters / 1000).toFixed(1)}km`}
            </Text>
          </View>
          {/* tags */}
          <View style={styles.tagRow}>
            {user.actionTags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
          {user.vibe ? (
            <Text style={styles.vibe} numberOfLines={1}>♫ {user.vibe}</Text>
          ) : null}
        </View>
      </View>
      {/* actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btnPing, pingState === "sent" && styles.btnPingSent]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onPing(); }}
        >
          <Text style={styles.btnPingText}>
            {pingState === "sent" ? "⬤  PINGED" : "PING"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnVector} onPress={onVector}>
          <Text style={styles.btnVectorText}>VECTOR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnClose} onPress={onClose}>
          <Text style={styles.btnCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filter, setFilter }) {
  const opts = ["all", "ready", "verified"] as const;
  return (
    <View style={styles.filterBar}>
      {opts.map(f => (
        <TouchableOpacity
          key={f}
          style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          onPress={() => setFilter(f)}
        >
          <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
            {f === "all" ? "ALL" : f === "ready" ? "READY" : "VERIFIED"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main map screen ───────────────────────────────────────────────────────────
export function MapScreen() {
  const {
    myLat, myLng, nearbyUsers, heatZones,
    selectedUser, selectUser, showVector, toggleVector,
    filter, setFilter, readyNow, setReadyNow,
  } = useAppStore();

  const [pingState, setPingState] = useState<"idle" | "sent">("idle");
  const { onTap: ghostTap, ghostMode } = useGhostTap();
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const refreshPulse = useRef(new Animated.Value(0)).current;

  useLocationBroadcast();

  // refresh pulse animation (30s cycle)
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(refreshPulse, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.delay(29500),
        Animated.timing(refreshPulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const filteredUsers = nearbyUsers.filter(u => {
    if (filter === "ready") return u.readyNow;
    if (filter === "verified") return u.verified;
    return true;
  });

  const handlePing = useCallback(() => {
    if (!selectedUser) return;
    setPingState("sent");
    send({ type: "ping_send", toUserId: selectedUser.id });
  }, [selectedUser]);

  const handleVector = useCallback(() => {
    if (!selectedUser) return;
    toggleVector();
    // Fly camera to frame both points
    if (myLat && myLng && selectedUser.lat && selectedUser.lng) {
      cameraRef.current?.fitBounds(
        [Math.min(myLng, selectedUser.lng) - 0.002, Math.min(myLat, selectedUser.lat) - 0.002],
        [Math.max(myLng, selectedUser.lng) + 0.002, Math.max(myLat, selectedUser.lat) + 0.002],
        [100, 100, 300, 100],
        800
      );
    }
    Haptics.selectionAsync();
  }, [selectedUser, myLat, myLng]);

  const readyNowCount = filteredUsers.filter(u => u.readyNow).length;
  const verifiedCount = filteredUsers.filter(u => u.verified).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* MAP */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        rotateEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={() => selectUser(null)}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [myLng ?? -74.006, myLat ?? 40.7128],
            zoomLevel: 15,
          }}
          followUserLocation={!selectedUser}
          followUserMode={MapboxGL.UserTrackingMode.Follow}
          animationMode="flyTo"
          animationDuration={800}
        />

        {/* User location dot */}
        <MapboxGL.UserLocation visible={!ghostMode} renderMode="native" />

        {/* Heat zones */}
        {heatZones.length > 0 && (
          <MapboxGL.ShapeSource
            id="heat"
            shape={buildHeatGeoJSON(heatZones) as any}
          >
            <MapboxGL.HeatmapLayer
              id="heatLayer"
              style={{
                heatmapColor: [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0, "rgba(0,0,0,0)",
                  0.3, "rgba(204,17,51,0.3)",
                  0.7, "rgba(204,17,51,0.6)",
                  1, "rgba(255,26,68,0.9)",
                ],
                heatmapRadius: 40,
                heatmapOpacity: 0.7,
                heatmapWeight: ["get", "density"],
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Vector line */}
        {showVector && selectedUser?.lat && myLat && myLng && (
          <MapboxGL.ShapeSource
            id="vector"
            shape={buildVectorGeoJSON(myLng, myLat, selectedUser.lng!, selectedUser.lat) as any}
          >
            <MapboxGL.LineLayer
              id="vectorLine"
              style={{
                lineColor: C.crimson,
                lineWidth: 2,
                lineDasharray: [4, 3],
                lineOpacity: 0.9,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* User pins */}
        {filteredUsers.map(u => (
          <UserPin
            key={u.id}
            user={u}
            selected={selectedUser?.id === u.id}
            onPress={(u) => {
              selectUser(u);
              setPingState("idle");
              Haptics.selectionAsync();
            }}
          />
        ))}
      </MapboxGL.MapView>

      {/* TOP HUD */}
      <View style={styles.topHud} pointerEvents="box-none">
        {/* wordmark + ghost */}
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>PROXM</Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={ghostTap}>
            <View style={[styles.ghostDot, ghostMode && styles.ghostDotActive]} />
            <Text style={styles.ghostLabel}>{ghostMode ? "GHOST" : "LIVE"}</Text>
          </TouchableOpacity>
        </View>

        {/* refresh bar */}
        <Animated.View style={[
          styles.refreshBar,
          {
            opacity: refreshPulse,
            backgroundColor: C.crimson,
          }
        ]} />

        {/* Filter + stats */}
        <View style={styles.hudMid} pointerEvents="box-none">
          <FilterBar filter={filter} setFilter={setFilter} />
          <View style={styles.statsCol}>
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: C.crimson }]} />
              <Text style={styles.statText}>{readyNowCount} READY</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={[styles.statText, { color: C.electric }]}>✓ {verifiedCount}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Ready Now toggle */}
      <TouchableOpacity
        style={[styles.readyBtn, readyNow && styles.readyBtnActive]}
        onPress={() => {
          setReadyNow(!readyNow);
          send({ type: "location_broadcast", lat: myLat ?? 0, lng: myLng ?? 0, accuracy: 5 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <Text style={[styles.readyText, readyNow && styles.readyTextActive]}>
          {readyNow ? "READY NOW" : "SET READY"}
        </Text>
      </TouchableOpacity>

      {/* Profile sheet */}
      <ProfileSheet
        user={selectedUser}
        onClose={() => selectUser(null)}
        onPing={handlePing}
        onVector={handleVector}
        pingState={pingState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },

  // HUD
  topHud: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
  },
  topRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, marginBottom: 4,
  },
  wordmark: {
    fontFamily: "BebasNeue_400Regular", fontSize: 28,
    color: "#fff", letterSpacing: 8,
  },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#222", paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  ghostDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#333" },
  ghostDotActive: { backgroundColor: C.crimson, shadowColor: C.crimson, shadowOpacity: 1, shadowRadius: 4 },
  ghostLabel: { fontSize: 9, letterSpacing: 3, color: "#555", fontFamily: "SpaceMono_400Regular" },
  refreshBar: { height: 2, marginHorizontal: 0 },
  hudMid: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", paddingHorizontal: 16, marginTop: 8,
  },
  statsCol: { gap: 6 },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.8)", borderWidth: 1, borderColor: "#181818",
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statDot: { width: 5, height: 5, borderRadius: 2.5 },
  statText: { fontSize: 8, letterSpacing: 2, color: "#555", fontFamily: "SpaceMono_400Regular" },

  // Filter
  filterBar: { flexDirection: "row", gap: 4 },
  filterBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "#181818",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  filterBtnActive: { backgroundColor: C.crimson, borderColor: C.crimson },
  filterText: { fontSize: 8, letterSpacing: 2, color: "#555", fontFamily: "SpaceMono_400Regular" },
  filterTextActive: { color: "#fff" },

  // Ready btn
  readyBtn: {
    position: "absolute", bottom: 220, right: 16,
    borderWidth: 1, borderColor: "#333",
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  readyBtnActive: { borderColor: C.crimson, backgroundColor: C.crimsonLo },
  readyText: { fontSize: 9, letterSpacing: 3, color: "#555", fontFamily: "SpaceMono_700Bold" },
  readyTextActive: { color: C.crimson },

  // Pins
  pin: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#111", borderWidth: 1.5, borderColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  pinReady: {
    backgroundColor: "rgba(204,17,51,0.85)", borderColor: C.crimson,
    shadowColor: C.crimson, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  pinSelected: { borderColor: "#fff", borderWidth: 2 },
  pinText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "BebasNeue_400Regular" },
  pinRing: {
    position: "absolute", width: 56, height: 56, borderRadius: 28,
    borderWidth: 1, borderColor: "rgba(204,17,51,0.3)",
    top: -8, left: -8,
  },
  verifiedBadge: {
    position: "absolute", top: -4, right: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.electric, alignItems: "center", justifyContent: "center",
  },
  verifiedText: { fontSize: 8, color: "#000", fontWeight: "700" },

  // Sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#080808", borderTopWidth: 1, borderTopColor: C.crimson,
    paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 32, height: 3, borderRadius: 2, backgroundColor: "#333",
    alignSelf: "center", marginBottom: 16,
  },
  sheetRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  avatar: {
    width: 56, height: 56, backgroundColor: C.crimsonLo,
    borderWidth: 1, borderColor: C.crimson,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontFamily: "BebasNeue_400Regular" },
  sheetInfo: { flex: 1 },
  sheetName: { color: "#fff", fontSize: 22, fontFamily: "BebasNeue_400Regular", letterSpacing: 1, marginBottom: 6 },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 8 },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 8, letterSpacing: 2, fontFamily: "SpaceMono_700Bold" },
  distText: { fontSize: 9, color: "#555", letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  tagRow: { flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 6 },
  tag: { backgroundColor: C.electricLo, borderWidth: 1, borderColor: C.electric, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: C.electric, fontSize: 10, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  vibe: { color: "#555", fontSize: 10, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  actionRow: { flexDirection: "row", gap: 8 },
  btnPing: {
    flex: 1, paddingVertical: 16,
    borderWidth: 2, borderColor: C.crimson,
    alignItems: "center", justifyContent: "center",
  },
  btnPingSent: { backgroundColor: C.crimsonLo },
  btnPingText: { color: C.crimson, fontSize: 12, letterSpacing: 4, fontFamily: "SpaceMono_700Bold" },
  btnVector: {
    flex: 1, paddingVertical: 16,
    borderWidth: 1, borderColor: C.electric,
    alignItems: "center", justifyContent: "center",
  },
  btnVectorText: { color: C.electric, fontSize: 12, letterSpacing: 4, fontFamily: "SpaceMono_700Bold" },
  btnClose: {
    width: 52, paddingVertical: 16,
    borderWidth: 1, borderColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  btnCloseText: { color: "#666", fontSize: 16 },
});
