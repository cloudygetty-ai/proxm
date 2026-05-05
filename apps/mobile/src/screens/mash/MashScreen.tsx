import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Platform,
} from "react-native";
import { useAppStore } from "../../store/useAppStore";
import { send } from "../../services/websocket";
import type { MashTrigger } from "@proxm/types";

const C = {
  void: "#000", surface: "#060606", border: "#181818",
  muted: "#333", ghost: "#666", text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.12)",
  electric: "#00aaff", amber: "#ff7700",
};

const PRESET_TRIGGERS: Omit<MashTrigger, "id" | "userId" | "createdAt">[] = [
  {
    name: "Developer Nearby",
    condition: { type: "proximity", radiusMeters: 60, tags: ["#Developer"] },
    action: { type: "vibrate", vibrationPattern: [0, 100, 100, 100] },
    enabled: true,
  },
  {
    name: "Ready Now · 200ft",
    condition: { type: "proximity", radiusMeters: 60 },
    action: { type: "vibrate", vibrationPattern: [0, 300] },
    enabled: false,
  },
  {
    name: "Verified Only",
    condition: { type: "verified_only" },
    action: { type: "notify", notificationTitle: "Verified user nearby" },
    enabled: false,
  },
];

function TriggerCard({ trigger, onToggle, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{trigger.name}</Text>
        <Switch
          value={trigger.enabled}
          onValueChange={onToggle}
          trackColor={{ false: C.muted, true: C.crimson }}
          thumbColor={C.bright}
        />
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaChip}>
          <Text style={styles.metaText}>
            {trigger.condition.type === "proximity"
              ? `◉  ${trigger.condition.radiusMeters}m radius`
              : trigger.condition.type === "tag_match"
              ? `⬡  tag match`
              : `✓  verified only`}
          </Text>
        </View>
        <View style={[styles.metaChip, { borderColor: C.electric }]}>
          <Text style={[styles.metaText, { color: C.electric }]}>
            {trigger.action.type === "vibrate" ? "⚡ vibrate"
             : trigger.action.type === "notify" ? "🔔 notify"
             : trigger.action.type === "show_vector" ? "→ vector"
             : "⚑ ping"}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MashScreen() {
  const { mashTriggers, setMashTriggers } = useAppStore();

  // Seed with presets if empty
  const [triggers, setTriggers] = useState<MashTrigger[]>(
    mashTriggers.length > 0 ? mashTriggers : PRESET_TRIGGERS.map((t, i) => ({
      ...t, id: `preset-${i}`, userId: "", createdAt: new Date(),
    }))
  );

  const syncTriggers = (next: MashTrigger[]) => {
    setTriggers(next);
    setMashTriggers(next);
    send({ type: "mash_sync", triggers: next });
  };

  const toggleTrigger = (id: string) => {
    syncTriggers(triggers.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const deleteTrigger = (id: string) => {
    syncTriggers(triggers.filter(t => t.id !== id));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>MASH</Text>
        <Text style={styles.subtitle}>IF / THEN TRIGGERS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionLabel}>ACTIVE RULES</Text>
        {triggers.map(t => (
          <TriggerCard
            key={t.id}
            trigger={t}
            onToggle={() => toggleTrigger(t.id)}
            onDelete={() => deleteTrigger(t.id)}
          />
        ))}

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>INSTANT CHECK-IN</Text>
        <View style={styles.consoleBox}>
          <Text style={styles.consoleLabel}>BROADCAST TO CIRCLE</Text>
          {["#Now · Downtown", "#Late · Home", "#Discreet · Location off"].map(cmd => (
            <TouchableOpacity key={cmd} style={styles.consoleRow}>
              <Text style={styles.consolePrompt}>›</Text>
              <Text style={styles.consoleCmd}>{cmd}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    fontFamily: "BebasNeue_400Regular", fontSize: 42,
    color: C.bright, letterSpacing: 10,
  },
  subtitle: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular",
  },
  list: { padding: 24, gap: 12 },
  sectionLabel: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 12,
  },
  card: {
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, padding: 16, marginBottom: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardName: { color: C.text, fontSize: 13, letterSpacing: 1, fontFamily: "SpaceMono_700Bold" },
  cardMeta: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metaChip: {
    borderWidth: 1, borderColor: C.muted,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  metaText: { color: C.ghost, fontSize: 9, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  deleteBtn: { alignSelf: "flex-end" },
  deleteText: { color: C.muted, fontSize: 8, letterSpacing: 2, fontFamily: "SpaceMono_400Regular" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 24 },
  consoleBox: {
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
    padding: 16,
  },
  consoleLabel: {
    fontSize: 8, letterSpacing: 3, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 12,
  },
  consoleRow: { flexDirection: "row", gap: 10, paddingVertical: 8 },
  consolePrompt: { color: C.crimson, fontSize: 12, fontFamily: "SpaceMono_700Bold" },
  consoleCmd: { color: C.text, fontSize: 11, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
});
