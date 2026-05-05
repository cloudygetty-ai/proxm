import { router } from "expo-router";
import { PhoneScreen } from "../../src/screens/auth/PhoneScreen";
export default function PhoneRoute() { return <PhoneScreen navigation={{ navigate: (r,p) => router.push({ pathname: r, params: p }) }} />; }
