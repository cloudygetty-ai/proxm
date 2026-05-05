import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useAppStore } from "../src/store/useAppStore";
import { connect as wsConnect } from "../src/services/websocket";
import { IncomingPingModal, AudioChannelModal } from "../src/screens/ping/PingScreens";
import { GhostOverlay } from "../src/screens/GhostOverlay";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  const { setAuth, accessToken, ghostMode } = useAppStore();

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    (async () => {
      const token = await SecureStore.getItemAsync("proxm_access_token");
      if (token) {
        try {
          const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            setAuth(json.data.id, token, json.data);
            wsConnect(token);
          }
        } catch {}
      }
      await SplashScreen.hideAsync();
    })();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
        <IncomingPingModal />
        <AudioChannelModal />
        {ghostMode && <GhostOverlay />}
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
