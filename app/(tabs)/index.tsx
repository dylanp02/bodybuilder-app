// app/(tabs)/index.tsx
// The home screen — shows today's summary and quick actions
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { Workout } from '../../lib/types';

export default function TodayScreen() {
  const [userName, setUserName] = useState('');
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);

  const today = new Date().toISOString().split('T')[0]; // "2026-05-07"

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    // Load profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', user.id)
      .single();

    if (profile) setUserName(profile.full_name || profile.username);

    // Check if user already logged a workout today
    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (workout) setTodayWorkout(workout);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {userName || 'Athlete'} 👋
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </Text>
        </View>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {/* Today's workout card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Today's Training</Text>
        {todayWorkout ? (
          <>
            <Text style={styles.cardTitle}>{todayWorkout.name}</Text>
            <Text style={styles.cardSub}>Workout logged ✓</Text>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>No workout logged yet</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <Text style={styles.primaryButtonText}>Start Workout</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Placeholder cards — populated in Phase 3 */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>AI Coach</Text>
        <Text style={styles.cardTitle}>Coming in Phase 3</Text>
        <Text style={styles.cardSub}>Plateau analysis and recommendations</Text>
      </View>
    </ScrollView>
  );
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xl,
  },
  greeting: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  signOut: { fontSize: FontSize.sm, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  primaryButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
});