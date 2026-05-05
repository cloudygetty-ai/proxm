import { router } from "expo-router";
import { ProfileSetupScreen } from "../../src/screens/auth/ProfileSetup";
export default function ProfileRoute() { return <ProfileSetupScreen navigation={{ navigate: (r) => router.push(r) }} />; }
