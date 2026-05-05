import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export function SplashScreen({ onNext }) {
  return (
    <View style={s.root}>
      <Text style={s.wordmark}>PROXM</Text>
      <Text style={s.sub}>Deploy. Don't Browse.</Text>
      <TouchableOpacity style={s.btn} onPress={onNext}>
        <Text style={s.btnText}>ENTER</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  wordmark: { fontFamily: "BebasNeue_400Regular", fontSize: 72, color: "#fff", letterSpacing: 16, marginBottom: 8 },
  sub: { fontSize: 9, letterSpacing: 3, color: "#444", fontFamily: "SpaceMono_400Regular", marginBottom: 64 },
  btn: { paddingHorizontal: 64, paddingVertical: 20, backgroundColor: "#cc1133" },
  btnText: { color: "#fff", fontSize: 12, letterSpacing: 6, fontFamily: "SpaceMono_700Bold" },
});
