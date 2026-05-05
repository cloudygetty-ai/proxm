import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, KeyboardAvoidingView, Image,
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAppStore } from "../../store/useAppStore";

const C = {
  void: "#000", surface: "#060606", panel: "#0c0c0c",
  border: "#181818", muted: "#333", ghost: "#666",
  text: "#d8d8d8", bright: "#fff",
  crimson: "#cc1133", crimsonLo: "rgba(204,17,51,0.12)",
  electric: "#00aaff", electricLo: "rgba(0,170,255,0.12)",
  amber: "#ff7700",
};

const ALL_TAGS = [
  "#Now", "#Drinks", "#Discreet", "#Talk", "#Coffee",
  "#Walk", "#Drive", "#Late", "#Rooftop", "#Gym",
  "#Developer", "#Creative", "#Chill", "#Fast",
  "#NSA", "#Spontaneous", "#Social", "#Outdoors",
];

// ── Profile setup screen ──────────────────────────────────────────────────────
export function ProfileSetupScreen({ navigation }) {
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { accessToken } = useAppStore();

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (name.trim().length < 2) return;
    setUploading(true);
    try {
      const body: Record<string, string> = {
        displayName: name.trim(),
        ...(vibe ? { vibeText: vibe } : {}),
      };
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("TagsSetup");
    } catch (err) {
      console.error("[ProfileSetupScreen]", err);
    } finally {
      setUploading(false);
    }
  };

  const canContinue = name.trim().length >= 2 && !uploading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* header */}
        <Text style={styles.wordmark}>PROXM</Text>
        <Text style={styles.stepLabel}>STEP 1 OF 2  ·  PROFILE</Text>

        {/* photo */}
        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImg} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📷</Text>
              <Text style={styles.photoLabel}>UPLOAD PHOTO</Text>
            </View>
          )}
          {photoUri && (
            <View style={styles.photoOverlay}>
              <Text style={styles.photoChange}>CHANGE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* display name */}
        <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={name}
            onChangeText={t => setName(t.slice(0, 24))}
            placeholder="How you appear on the map"
            placeholderTextColor="#333"
            style={styles.input}
            maxLength={24}
            returnKeyType="next"
            autoCapitalize="words"
          />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${(name.length / 24) * 100}%` as any,
            backgroundColor: name.length > 20 ? C.amber : C.crimson,
          }]} />
        </View>
        <Text style={styles.charCount}>{name.length}/24</Text>

        {/* vibe */}
        <Text style={[styles.fieldLabel, { marginTop: 24 }]}>
          VIBE <Text style={{ color: C.muted }}>· OPTIONAL</Text>
        </Text>
        <View style={[styles.inputWrap, { borderColor: C.border }]}>
          <TextInput
            value={vibe}
            onChangeText={t => setVibe(t.slice(0, 60))}
            placeholder="Artist · Track or what you're building"
            placeholderTextColor="#333"
            style={[styles.input, { fontSize: 13 }]}
            maxLength={60}
            returnKeyType="done"
          />
        </View>
        <Text style={styles.fieldHint}>Shown as scrolling ticker on your map pin</Text>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>
            {uploading ? "SAVING···" : "CONTINUE"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Tags setup screen ─────────────────────────────────────────────────────────
export function TagsSetupScreen({ navigation }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { accessToken, setAuth, profile, userId, tokens } = useAppStore();

  const toggle = (tag: string) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const handleDeploy = async () => {
    if (selected.length !== 3) return;
    setSaving(true);
    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          actionTag1: selected[0],
          actionTag2: selected[1],
          actionTag3: selected[2],
          readyNow: true,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("Main");
    } catch (err) {
      console.error("[TagsSetupScreen]", err);
    } finally {
      setSaving(false);
    }
  };

  const canDeploy = selected.length === 3 && !saving;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.wordmark}>PROXM</Text>
      <Text style={styles.stepLabel}>STEP 2 OF 2  ·  ACTION TAGS</Text>
      <Text style={styles.tagsSubtitle}>
        This is your entire profile.{"\n"}Choose fast.
      </Text>

      {/* Tag grid */}
      <View style={styles.tagGrid}>
        {ALL_TAGS.map((tag, i) => {
          const isSelected = selected.includes(tag);
          const isDisabled = !isSelected && selected.length >= 3;
          const selIdx = selected.indexOf(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => !isDisabled && toggle(tag)}
              style={[
                styles.tagBtn,
                isSelected && styles.tagBtnSelected,
                isDisabled && styles.tagBtnDisabled,
              ]}
              activeOpacity={isDisabled ? 1 : 0.7}
            >
              <Text style={[
                styles.tagBtnText,
                isSelected && styles.tagBtnTextSelected,
                isDisabled && styles.tagBtnTextDisabled,
              ]}>
                {tag}
              </Text>
              {isSelected && (
                <View style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{selIdx + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected preview */}
      <View style={styles.selectedRow}>
        {selected.map(t => (
          <View key={t} style={styles.selectedTag}>
            <Text style={styles.selectedTagText}>{t}</Text>
          </View>
        ))}
        {Array.from({ length: 3 - selected.length }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.emptySlot}>
            <Text style={styles.emptySlotText}>—</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !canDeploy && styles.continueBtnDisabled]}
        onPress={handleDeploy}
        disabled={!canDeploy}
      >
        <Text style={styles.continueBtnText}>
          {saving ? "DEPLOYING···" : canDeploy ? "GO LIVE" : `PICK ${3 - selected.length} MORE`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  content: { paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 64 : 40, paddingBottom: 40 },
  wordmark: {
    fontFamily: "BebasNeue_400Regular", fontSize: 42,
    color: C.bright, letterSpacing: 10, marginBottom: 4,
  },
  stepLabel: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 32,
  },

  // Photo
  photoBtn: {
    height: 160, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, marginBottom: 32,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  photoPlaceholder: { alignItems: "center", gap: 8 },
  photoIcon: { fontSize: 28 },
  photoLabel: { fontSize: 9, letterSpacing: 3, color: C.ghost, fontFamily: "SpaceMono_400Regular" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  photoChange: { color: C.bright, fontSize: 11, letterSpacing: 4, fontFamily: "SpaceMono_700Bold" },

  // Fields
  fieldLabel: {
    fontSize: 9, letterSpacing: 4, color: C.ghost,
    fontFamily: "SpaceMono_400Regular", marginBottom: 8,
  },
  fieldHint: {
    fontSize: 9, letterSpacing: 1, color: C.muted,
    fontFamily: "SpaceMono_400Regular", marginTop: 6,
  },
  inputWrap: {
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  input: {
    color: C.bright, fontSize: 15, padding: 18,
    fontFamily: "SpaceMono_400Regular", letterSpacing: 1,
  },
  progressTrack: { height: 2, backgroundColor: C.border },
  progressFill: { height: "100%", transition: "width 0.15s" },
  charCount: {
    fontSize: 9, color: C.muted, letterSpacing: 1,
    fontFamily: "SpaceMono_400Regular", textAlign: "right", marginTop: 4,
  },

  // Continue btn
  continueBtn: {
    marginTop: 40, paddingVertical: 20,
    backgroundColor: C.crimson, alignItems: "center",
    shadowColor: C.crimson, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  continueBtnDisabled: { backgroundColor: C.muted, shadowOpacity: 0 },
  continueBtnText: {
    color: C.bright, fontSize: 12, letterSpacing: 5, fontFamily: "SpaceMono_700Bold",
  },

  // Tags
  tagsSubtitle: {
    fontSize: 12, color: C.ghost, letterSpacing: 1,
    fontFamily: "SpaceMono_400Regular", lineHeight: 22, marginBottom: 28,
  },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  tagBtn: {
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
    position: "relative",
  },
  tagBtnSelected: {
    borderColor: C.crimson, backgroundColor: C.crimsonLo,
    shadowColor: C.crimson, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  tagBtnDisabled: { borderColor: C.panel, opacity: 0.4 },
  tagBtnText: { color: C.text, fontSize: 11, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  tagBtnTextSelected: { color: C.bright },
  tagBtnTextDisabled: { color: C.muted },
  tagBadge: {
    position: "absolute", top: -6, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.bright, alignItems: "center", justifyContent: "center",
  },
  tagBadgeText: { color: C.void, fontSize: 9, fontWeight: "700" },

  // Selected preview
  selectedRow: { flexDirection: "row", gap: 8, marginBottom: 8, minHeight: 38 },
  selectedTag: {
    borderWidth: 1, borderColor: C.crimson,
    backgroundColor: C.crimsonLo, paddingHorizontal: 12, paddingVertical: 6,
  },
  selectedTagText: { color: C.crimson, fontSize: 11, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  emptySlot: {
    borderWidth: 1, borderColor: C.border, borderStyle: "dashed",
    paddingHorizontal: 12, paddingVertical: 6,
  },
  emptySlotText: { color: C.muted, fontSize: 11, fontFamily: "SpaceMono_400Regular" },
});
