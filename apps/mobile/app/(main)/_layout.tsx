import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useAppStore } from "../../src/store/useAppStore";
import { connect as wsConnect } from "../../src/services/websocket";

function TabIcon({ label, icon, focused }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 6, gap: 2 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      {focused && (
        <Text style={{ fontSize: 7, letterSpacing: 2, color: "#cc1133", fontFamily: "SpaceMono_400Regular" }}>
          {label}
        </Text>
      )}
    </View>
  );
}

export default function MainLayout() {
  const { accessToken } = useAppStore();
  useEffect(() => {
    if (!accessToken) { router.replace("/(auth)"); return; }
    wsConnect(accessToken);
  }, [accessToken]);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: "#000", borderTopColor: "#181818", borderTopWidth: 1, height: 72, paddingBottom: 12 },
      tabBarActiveTintColor: "#cc1133",
      tabBarInactiveTintColor: "#333",
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="map"      options={{ tabBarIcon: ({ focused }) => <TabIcon label="MAP"  icon="◉" focused={focused} /> }} />
      <Tabs.Screen name="mash"     options={{ tabBarIcon: ({ focused }) => <TabIcon label="MASH" icon="⚡" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon label="ME"   icon="◈" focused={focused} /> }} />
    </Tabs>
  );
}
