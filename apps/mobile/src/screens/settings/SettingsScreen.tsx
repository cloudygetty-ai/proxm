import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { useAppStore } from "../../store/useAppStore";
import { disconnect as wsDisconnect } from "../../services/websocket";

const C = {
  void: "#000", surface: "#060606", border: "#181818",
  muted: "#333", ghost: "#666", text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.12)",
  electric: "#00aaff",
};

function Row({ label, value = "", onPress = undefined, danger = false, mono = false }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value ? (
        <Text style={[styles.rowValue, mono && styles.rowValueMono]}>{value}</Text>
      ) : onPress ? (
        <Text style={styles.rowArrow}>›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const { profile, clearAuth, userId } = useAppStore();

  const handleLogout = async () => {
    wsDisconnect();
    await SecureStore.deleteItemAsync("proxm_access_token");
    await SecureStore.deleteItemAsync("proxm_refresh_token");
    clearAuth();
    router.replace("/(auth)");
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          {profile?.displayName?.toUpperCase() ?? "PROXM"}
        </Text>
        <Text style={styles.subtitle}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* Profile */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <View style={styles.section}>
          <Row label="Display Name" value={profile?.displayName} />
          <Row
            label="Action Tags"
            value={[profile?.actionTag1, profile?.actionTag2, profile?.actionTag3]
              .filter(Boolean).join(" · ")}
          />
          <Row label="Edit Profile" onPress={() => router.push("/(auth)/profile")} />
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.section}>
          <Row label="User ID" value={userId?.slice(0, 12) + "···"} mono />
          <Row label="Face Verification" value="Not verified" />
          <Row label="Verify Now" onPress={() => {}} />
        </View>

        {/* Privacy */}
        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.section}>
          <Row label="Ghost Mode" onPress={() => {}} />
          <Row label="Block List" onPress={() => {}} />
          <Row label="Data & Privacy" onPress={() => {}} />
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionLabel}>SESSION</Text>
        <View style={styles.section}>
          <Row label="Sign Out" onPress={handleLogout} danger />
        </View>

        <Text style={styles.version}>PROXM v1.0.0 · cloudygetty-ai</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: {
    paddingTop: Platform.OS === "ios" ? 64 : 40,
    paddingHorizontal: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  wordmark: {
    fontFamily: "BebasNeue_400Regular", fontSize: 36,
    color: C.bright, letterSpacing: 6,
  },
  subtitle: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular",
  },
  list: { padding: 24 },
  sectionLabel: {
    fontSize: 8, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 8, marginTop: 16,
  },
  section: {
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rowLabel: { color: C.text, fontSize: 12, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  rowLabelDanger: { color: C.crimson },
  rowValue: { color: C.ghost, fontSize: 11, letterSpacing: 1, fontFamily: "SpaceMono_400Regular", maxWidth: "55%" },
  rowValueMono: { fontFamily: "SpaceMono_400Regular", fontSize: 10 },
  rowArrow: { color: C.muted, fontSize: 18 },
  version: {
    textAlign: "center", marginTop: 40,
    fontSize: 8, letterSpacing: 2, color: C.muted,
    fontFamily: "SpaceMono_400Regular",
  },
});
