// app/(tabs)/coach.tsx — replaced by the Planner screen (see planner.tsx)
import { Redirect } from 'expo-router';
export default function CoachRedirect() {
  return <Redirect href="/(tabs)/planner" />;
}
