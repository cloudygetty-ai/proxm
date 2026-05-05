import { router } from "expo-router";
import { TagsSetupScreen } from "../../src/screens/auth/ProfileSetup";
export default function TagsRoute() { return <TagsSetupScreen navigation={{ replace: (r) => router.replace(r) }} />; }
