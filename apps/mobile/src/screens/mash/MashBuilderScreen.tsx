import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Platform, Modal, Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../../store/useAppStore";
import { send } from "../../services/websocket";
import type { MashTrigger, MashCondition, MashAction } from "@proxm/types";

const C = {
  void: "#000", surface: "#060606", panel: "#0c0c0c",
  border: "#181818", muted: "#333", ghost: "#666",
  text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.12)",
  electric: "#00aaff", electricLo: "rgba(0,170,255,0.1)",
  amber: "#ff7700",
};

const CONDITION_TYPES: { key: MashCondition["type"]; label: string; desc: string }[] = [
  { key: "proximity",     label: "PROXIMITY",    desc: "User enters radius" },
  { key: "tag_match",     label: "TAG MATCH",    desc: "User has matching tag" },
  { key: "verified_only", label: "VERIFIED ONLY", desc: "Verified user nearby" },
];

const ACTION_TYPES: { key: MashAction["type"]; label: string; desc: string }[] = [
  { key: "vibrate",     label: "VIBRATE",      desc: "Custom haptic pattern" },
  { key: "notify",      label: "NOTIFY",       desc: "Push notification" },
  { key: "show_vector", label: "SHOW VECTOR",  desc: "Draw nav line on map" },
  { key: "auto_ping",   label: "AUTO PING",    desc: "Send ping automatically" },
];

const RADIUS_PRESETS = [30, 60, 100, 200, 500];
const TAG_OPTIONS = ["#Now", "#Developer", "#Drinks", "#Discreet", "#Talk", "#Late", "#Verified"];

function SelectBtn({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.selectBtn, active && styles.selectBtnActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.selectBtnText, active && styles.selectBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ text, sub = "" }) {
  return (
    <View style={{ marginBottom: 10, marginTop: 20 }}>
      <Text style={styles.fieldLabel}>{text}</Text>
      {sub ? <Text style={styles.fieldSub}>{sub}</Text> : null}
    </View>
  );
}

export function MashBuilderScreen({ navigation }) {
  const { mashTriggers, setMashTriggers } = useAppStore();

  const [name, setName] = useState("");
  const [condType, setCondType] = useState<MashCondition["type"]>("proximity");
  const [radius, setRadius] = useState(60);
  const [tags, setTags] = useState<string[]>([]);
  const [actionType, setActionType] = useState<MashAction["type"]>("vibrate");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    Haptics.selectionAsync();
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const canSave = name.trim().length >= 2 &&
    (condType !== "tag_match" || tags.length > 0) &&
    (actionType !== "notify" || notifyTitle.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);

    const newTrigger: MashTrigger = {
      id: `trigger-${Date.now()}`,
      userId: "",
      name: name.trim(),
      condition: {
        type: condType,
        ...(condType === "proximity" ? { radiusMeters: radius } : {}),
        ...(condType === "tag_match" ? { tags: tags as `#${string}`[] } : {}),
      },
      action: {
        type: actionType,
        ...(actionType === "vibrate" ? { vibrationPattern: [0, 100, 80, 100, 80, 200] } : {}),
        ...(actionType === "notify" ? { notificationTitle: notifyTitle.trim() } : {}),
      },
      enabled: true,
      createdAt: new Date(),
    };

    const updated = [...mashTriggers, newTrigger];
    setMashTriggers(updated);
    send({ type: "mash_sync", triggers: updated });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.wordmark}>NEW TRIGGER</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* name */}
        <FieldLabel text="TRIGGER NAME" />
        <View style={styles.inputWrap}>
          <TextInput
            value={name}
            onChangeText={t => setName(t.slice(0, 32))}
            placeholder="e.g. Developer Nearby"
            placeholderTextColor="#333"
            style={styles.input}
            maxLength={32}
          />
        </View>

        {/* condition */}
        <FieldLabel text="IF ——" sub="When this condition is met" />
        <View style={styles.chipRow}>
          {CONDITION_TYPES.map(c => (
            <SelectBtn
              key={c.key}
              label={c.label}
              active={condType === c.key}
              onPress={() => { setCondType(c.key); Haptics.selectionAsync(); }}
            />
          ))}
        </View>
        <Text style={styles.condDesc}>
          {CONDITION_TYPES.find(c => c.key === condType)?.desc}
        </Text>

        {/* condition params */}
        {condType === "proximity" && (
          <>
            <FieldLabel text="RADIUS" sub="Distance in meters" />
            <View style={styles.chipRow}>
              {RADIUS_PRESETS.map(r => (
                <SelectBtn
                  key={r}
                  label={`${r}m`}
                  active={radius === r}
                  onPress={() => { setRadius(r); Haptics.selectionAsync(); }}
                />
              ))}
            </View>
          </>
        )}

        {condType === "tag_match" && (
          <>
            <FieldLabel text="MATCH TAGS" sub="Trigger fires if user has any of these" />
            <View style={styles.chipRow}>
              {TAG_OPTIONS.map(t => (
                <SelectBtn
                  key={t}
                  label={t}
                  active={tags.includes(t)}
                  onPress={() => toggleTag(t)}
                />
              ))}
            </View>
          </>
        )}

        {/* action */}
        <FieldLabel text="THEN ——" sub="Execute this action" />
        <View style={styles.chipRow}>
          {ACTION_TYPES.map(a => (
            <SelectBtn
              key={a.key}
              label={a.label}
              active={actionType === a.key}
              onPress={() => { setActionType(a.key); Haptics.selectionAsync(); }}
            />
          ))}
        </View>
        <Text style={styles.condDesc}>
          {ACTION_TYPES.find(a => a.key === actionType)?.desc}
        </Text>

        {/* action params */}
        {actionType === "notify" && (
          <>
            <FieldLabel text="NOTIFICATION TITLE" />
            <View style={styles.inputWrap}>
              <TextInput
                value={notifyTitle}
                onChangeText={t => setNotifyTitle(t.slice(0, 40))}
                placeholder="Alert text"
                placeholderTextColor="#333"
                style={styles.input}
                maxLength={40}
              />
            </View>
          </>
        )}

        {/* preview */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>PREVIEW</Text>
          <Text style={styles.previewText}>
            IF{" "}
            <Text style={{ color: C.crimson }}>
              {condType === "proximity" ? `user within ${radius}m`
               : condType === "tag_match" ? `user has ${tags.join(" or ") || "…"}`
               : "verified user nearby"}
            </Text>
            {"\n"}THEN{" "}
            <Text style={{ color: C.electric }}>
              {actionType === "vibrate" ? "custom vibration pattern"
               : actionType === "notify" ? `notify "${notifyTitle || "…"}"`
               : actionType === "show_vector" ? "draw vector line on map"
               : "send auto ping"}
            </Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "SAVING···" : "DEPLOY TRIGGER"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: {
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingHorizontal: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: C.ghost, fontSize: 11, letterSpacing: 2, fontFamily: "SpaceMono_400Regular" },
  wordmark: { fontFamily: "BebasNeue_400Regular", fontSize: 32, color: C.bright, letterSpacing: 6 },
  content: { paddingHorizontal: 24, paddingBottom: 60 },

  fieldLabel: { fontSize: 9, letterSpacing: 4, color: C.ghost, fontFamily: "SpaceMono_400Regular" },
  fieldSub: { fontSize: 9, letterSpacing: 1, color: C.muted, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  condDesc: { fontSize: 10, color: C.muted, letterSpacing: 1, fontFamily: "SpaceMono_400Regular", marginTop: 6 },

  inputWrap: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  input: {
    color: C.bright, fontSize: 14, padding: 16,
    fontFamily: "SpaceMono_400Regular", letterSpacing: 1,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  selectBtnActive: { borderColor: C.crimson, backgroundColor: C.crimsonLo },
  selectBtnText: { color: C.ghost, fontSize: 10, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  selectBtnTextActive: { color: C.bright },

  previewBox: {
    marginTop: 32, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.panel, padding: 16,
  },
  previewLabel: { fontSize: 8, letterSpacing: 3, color: C.ghost, fontFamily: "SpaceMono_400Regular", marginBottom: 10 },
  previewText: { color: C.text, fontSize: 12, letterSpacing: 1, fontFamily: "SpaceMono_400Regular", lineHeight: 22 },

  saveBtn: {
    marginTop: 24, paddingVertical: 20, backgroundColor: C.crimson, alignItems: "center",
    shadowColor: C.crimson, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  saveBtnDisabled: { backgroundColor: C.muted, shadowOpacity: 0 },
  saveBtnText: { color: C.bright, fontSize: 12, letterSpacing: 5, fontFamily: "SpaceMono_700Bold" },
});
