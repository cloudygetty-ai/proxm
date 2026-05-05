import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";

export default function AuthLayout() {
  const accessToken = useAppStore(s => s.accessToken);
  useEffect(() => { if (accessToken) router.replace("/(main)/map"); }, [accessToken]);
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="tags" />
    </Stack>
  );
}
