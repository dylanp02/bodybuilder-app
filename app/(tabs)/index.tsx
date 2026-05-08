// app/(tabs)/index.tsx
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

interface TodayWorkout {
  id: string;
  name: string;
  workout_sets: { id: string }[];
}

interface RecentWorkout {
  id: string;
  name: string;
  date: string;
  workout_sets: { id: string }[];
}

export default function TodayScreen() {
  const [userName, setUserName] = useState('');
  const [todayWorkouts, setTodayWorkouts] = useState<TodayWorkout[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    const [profileRes, todayRes, recentRes] = await Promise.all([
      supabase.from('profiles').select('username, full_name').eq('id', user.id).single(),
      supabase
        .from('workouts')
        .select('id, name, workout_sets(id)')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('id, name, date, workout_sets(id)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(7),
    ]);

    if (profileRes.data) setUserName(profileRes.data.full_name || profileRes.data.username);
    if (todayRes.data) setTodayWorkouts(todayRes.data as TodayWorkout[]);
    if (recentRes.data) setRecentWorkouts(recentRes.data as RecentWorkout[]);
  };

  const avatarLabel = userName ? userName.charAt(0).toUpperCase() : '?';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => setShowMenu(v => !v)}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </Pressable>
        </View>

        {/* Today's workout card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today's Training</Text>
          {todayWorkouts.length > 0 ? (
            <>
              <Text style={styles.cardSub}>
                {todayWorkouts.length} {todayWorkouts.length === 1 ? 'workout' : 'workouts'} logged ✓
              </Text>
              {todayWorkouts.map(w => (
                <Pressable
                  key={w.id}
                  style={styles.todayWorkoutRow}
                  onPress={() => router.push(`/workout/${w.id}`)}
                >
                  <Text style={styles.todayWorkoutName}>{w.name}</Text>
                  <Text style={styles.todayWorkoutSets}>
                    {w.workout_sets.length} {w.workout_sets.length === 1 ? 'set' : 'sets'}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push('/(tabs)/workout')}
              >
                <Text style={styles.primaryButtonText}>Log Another Workout</Text>
              </Pressable>
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

        {/* Placeholder — Phase 3 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AI Coach</Text>
          <Text style={styles.cardTitle}>Coming in Phase 3</Text>
          <Text style={styles.cardSub}>Plateau analysis and recommendations</Text>
        </View>

        {/* Recent workouts */}
        {recentWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            {recentWorkouts.map(w => (
              <Pressable
                key={w.id}
                style={styles.historyCard}
                onPress={() => router.push(`/workout/${w.id}`)}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyName}>{w.name}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(w.date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.historyCount}>
                  {w.workout_sets.length} {w.workout_sets.length === 1 ? 'set' : 'sets'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Profile dropdown */}
      {showMenu && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
          <View style={styles.menuCard}>
            {(
              [
                { label: 'Account',  onPress: () => { setShowMenu(false); router.push('/account'); } },
                { label: 'Settings', onPress: () => { setShowMenu(false); router.push('/settings'); } },
                { label: 'Goals',    onPress: () => { setShowMenu(false); router.push('/goals'); } },
                { label: 'Sign Out', danger: true, onPress: async () => { setShowMenu(false); await supabase.auth.signOut(); } },
              ] as { label: string; onPress: () => void; danger?: boolean }[]
            ).map((item, i, arr) => (
              <Pressable
                key={item.label}
                style={[styles.menuItem, i < arr.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
              >
                <Text style={[styles.menuItemText, item.danger && styles.menuItemDanger]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AVATAR_SIZE = 38;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xl,
  },
  headerLeft: { flex: 1, marginRight: Spacing.md },
  greeting: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Avatar
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // Cards
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

  // Today workout rows
  todayWorkoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  todayWorkoutName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  todayWorkoutSets: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  primaryButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },

  // Recent workouts
  section: { marginTop: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  historyLeft: { flex: 1 },
  historyName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  historyCount: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  // Dropdown menu
  menuBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  menuCard: {
    position: 'absolute',
    top: 90,
    right: Spacing.lg,
    width: 180,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
  },
  menuItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuItemText: { fontSize: FontSize.md, color: Colors.text },
  menuItemDanger: { color: Colors.danger },
});
