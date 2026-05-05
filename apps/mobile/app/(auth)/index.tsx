import { router } from "expo-router";
import { SplashScreen } from "../../src/screens/auth/SplashScreen";
export default function AuthIndex() { return <SplashScreen onNext={() => router.push("/(auth)/phone")} />; }
