import { router, useLocalSearchParams } from "expo-router";
import { OtpScreen } from "../../src/screens/auth/OtpScreen";
export default function OtpRoute() { const { phone } = useLocalSearchParams(); return <OtpScreen route={{ params: { phone } }} navigation={{ replace: (r) => router.replace(r) }} />; }
