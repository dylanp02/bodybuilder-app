// app/workout-detail/[id].tsx — redirects to the canonical workout detail route
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function WorkoutDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/workout/${id}`} />;
}
