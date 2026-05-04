import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Vibration } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAppStore } from "../../store/useAppStore";

/**
 * OtpScreen — React Native production component
 * Wire: POST /api/auth/otp/verify { phone, otp }
 */
export function OtpScreen({ route, navigation }) {
  const { phone } = route.params;
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const setAuth = useAppStore(s => s.setAuth);

  const shake = () => {
    Vibration.vibrate([0, 60, 60, 60]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const verify = async (code) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: code }),
      });
      const json = await res.json();
      if (!json.ok) { shake(); setDigits(["","","","","",""]); setLoading(false); return; }
      await SecureStore.setItemAsync("proxm_access_token", json.data.accessToken);
      await SecureStore.setItemAsync("proxm_refresh_token", json.data.refreshToken);
      if (json.data.isNew) {
        navigation.replace("ProfileSetup");
      } else {
        navigation.replace("Main");
      }
    } catch {
      shake(); setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.wordmark}>PROXM</Text>
      <Text style={s.label}>VERIFICATION CODE</Text>
      <Text style={s.sub}>Sent to {phone}</Text>
      <Animated.View style={[s.row, { transform: [{ translateX: shakeAnim }] }]}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={refs[i]}
            value={d}
            onChangeText={v => {
              const next = [...digits];
              const char = v.replace(/\D/g, "").slice(-1);
              next[i] = char;
              setDigits(next);
              if (char && i < 5) refs[i+1].current?.focus();
              if (i === 5 && next.every(x => x)) verify(next.join(""));
            }}
            onKeyPress={({ nativeEvent: { key } }) => {
              if (key === "Backspace" && !digits[i] && i > 0) {
                refs[i-1].current?.focus();
                const next = [...digits]; next[i-1] = ""; setDigits(next);
              }
            }}
            keyboardType="number-pad"
            maxLength={1}
            style={[s.cell, d && s.cellFilled]}
          />
        ))}
      </Animated.View>
      {loading && <Text style={s.loading}>Verifying ···</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 24, justifyContent: "center" },
  wordmark: { color: "#fff", fontSize: 52, fontFamily: "BebasNeue_400Regular", letterSpacing: 12, marginBottom: 48 },
  label: { color: "#555", fontSize: 10, letterSpacing: 4, marginBottom: 8, fontFamily: "SpaceMono_400Regular" },
  sub: { color: "#333", fontSize: 11, letterSpacing: 1, marginBottom: 32, fontFamily: "SpaceMono_400Regular" },
  row: { flexDirection: "row", gap: 10, marginBottom: 32 },
  cell: {
    flex: 1, height: 60, borderWidth: 1, borderColor: "#222",
    backgroundColor: "#060606", color: "#fff",
    fontSize: 22, fontWeight: "700", textAlign: "center",
    fontFamily: "SpaceMono_700Bold",
  },
  cellFilled: { borderColor: "#cc1133", backgroundColor: "#0a0a0a" },
  loading: { color: "#555", fontSize: 10, letterSpacing: 4, textAlign: "center", fontFamily: "SpaceMono_400Regular" },
});
