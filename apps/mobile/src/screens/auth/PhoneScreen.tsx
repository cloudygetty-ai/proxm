import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * PhoneScreen — React Native production component
 * Pairs with the web prototype AuthFlow.jsx
 * Wire: POST /api/auth/otp/send { phone }
 */
export function PhoneScreen({ navigation }) {
  const [digits, setDigits] = React.useState("");

  const handleSubmit = async () => {
    if (digits.length !== 10) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+1${digits}` }),
      });
      if (res.ok) navigation.navigate("Otp", { phone: `+1${digits}` });
    } catch (err) {
      console.error("[PhoneScreen]", err);
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.wordmark}>PROXM</Text>
      <Text style={s.label}>ENTER YOUR NUMBER</Text>
      <TextInput
        style={s.input}
        value={digits}
        onChangeText={t => setDigits(t.replace(/\D/g, "").slice(0, 10))}
        keyboardType="phone-pad"
        placeholder="(000) 000-0000"
        placeholderTextColor="#444"
        maxLength={14}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      <TouchableOpacity
        style={[s.btn, digits.length !== 10 && s.btnDisabled]}
        onPress={handleSubmit}
        disabled={digits.length !== 10}
      >
        <Text style={s.btnText}>SEND CODE</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 24, justifyContent: "center" },
  wordmark: { color: "#fff", fontSize: 52, fontFamily: "BebasNeue_400Regular", letterSpacing: 12, marginBottom: 48 },
  label: { color: "#555", fontSize: 10, letterSpacing: 4, marginBottom: 16, fontFamily: "SpaceMono_400Regular" },
  input: {
    borderWidth: 1, borderColor: "#222", backgroundColor: "#060606",
    color: "#fff", fontSize: 18, padding: 18, marginBottom: 2,
    fontFamily: "SpaceMono_400Regular", letterSpacing: 2,
  },
  btn: {
    marginTop: 32, padding: 18, backgroundColor: "#cc1133",
    alignItems: "center",
  },
  btnDisabled: { backgroundColor: "#222" },
  btnText: { color: "#fff", fontSize: 12, letterSpacing: 5, fontFamily: "SpaceMono_700Bold", fontWeight: "700" },
});
