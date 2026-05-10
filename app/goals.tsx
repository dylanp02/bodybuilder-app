// app/goals.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';

type GoalKey = 'aesthetics' | 'strength' | 'endurance' | 'general';
type ExpKey = 'beginner' | 'intermediate' | 'advanced';

const GOALS: { key: GoalKey; label: string; sub: string }[] = [
  { key: 'aesthetics', label: 'Build Muscle',    sub: 'Hypertrophy and body composition' },
  { key: 'strength',   label: 'Build Strength',  sub: 'Power, compound lifts, max effort' },
  { key: 'endurance',  label: 'Endurance',        sub: 'Cardio capacity and conditioning' },
  { key: 'general',    label: 'General Fitness',  sub: 'Stay active and feel good' },
];

const EXPERIENCE: { key: ExpKey; label: string; sub: string }[] = [
  { key: 'beginner',     label: 'Beginner',      sub: 'Less than 1 year training' },
  { key: 'intermediate', label: 'Intermediate',  sub: '1–3 years consistent training' },
  { key: 'advanced',     label: 'Advanced',      sub: '3+ years, structured programming' },
];

const TRACKING_SECTIONS = [
  { title: 'Body Weight',   description: 'Log your current weight and view your history',        route: '/weight-history' },
  { title: 'Top Sets',      description: 'Record personal bests from before you started tracking', route: '/top-sets' },
  { title: 'Measurements',  description: 'Track neck, chest, waist, hips, biceps, and more',      route: '/measurements' },
];

export default function GoalsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [experience, setExperience] = useState<ExpKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('goal, experience_level')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      setGoal((data.goal as GoalKey) ?? null);
      setExperience((data.experience_level as ExpKey) ?? null);
    }
    setLoading(false);
  };

  const saveProfile = useCallback(async (
    nextGoal: GoalKey | null,
    nextExp: ExpKey | null,
  ) => {
    if (!nextGoal || !nextExp) return;
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, goal: nextGoal, experience_level: nextExp }, { onConflict: 'id' });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
  }, []);

  const selectGoal = (key: GoalKey) => {
    setGoal(key);
    saveProfile(key, experience);
  };

  const selectExperience = (key: ExpKey) => {
    setExperience(key);
    saveProfile(goal, key);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Goals</Text>

      {/* Training Profile */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Training Profile</Text>
          {saving && <ActivityIndicator size="small" color={Colors.primary} />}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : (
          <>
            <Text style={styles.subLabel}>Primary Goal</Text>
            {GOALS.map(item => {
              const selected = goal === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.choiceCard, selected && styles.choiceCardSelected]}
                  onPress={() => selectGoal(item.key)}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>
                      {item.label}
                    </Text>
                    <Text style={styles.choiceSub}>{item.sub}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={[styles.subLabel, { marginTop: Spacing.lg }]}>Experience Level</Text>
            {EXPERIENCE.map(item => {
              const selected = experience === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.choiceCard, selected && styles.choiceCardSelected]}
                  onPress={() => selectExperience(item.key)}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>
                      {item.label}
                    </Text>
                    <Text style={styles.choiceSub}>{item.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </View>

      {/* Tracking links */}
      <Text style={styles.sectionLabel}>Tracking</Text>
      {TRACKING_SECTIONS.map(item => (
        <Pressable
          key={item.route}
          style={styles.card}
          onPress={() => router.push(item.route as any)}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.description}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  subLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  loader: { marginVertical: Spacing.lg },

  choiceCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm, gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  choiceCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  choiceText: { flex: 1 },
  choiceTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  choiceTitleSelected: { color: Colors.primary },
  choiceSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1, marginRight: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  chevron: { fontSize: 22, color: Colors.textSecondary, fontWeight: '300' },
});
