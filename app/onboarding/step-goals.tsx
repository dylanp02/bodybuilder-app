import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';

type GoalKey = 'aesthetics' | 'strength' | 'endurance' | 'general';
type ExpKey = 'beginner' | 'intermediate' | 'advanced';

const GOALS: { key: GoalKey; label: string; sub: string }[] = [
  { key: 'aesthetics',  label: 'Build Muscle',       sub: 'Hypertrophy and body composition' },
  { key: 'strength',   label: 'Build Strength',      sub: 'Power, compound lifts, max effort' },
  { key: 'endurance',  label: 'Endurance',           sub: 'Cardio capacity and conditioning' },
  { key: 'general',    label: 'General Fitness',     sub: 'Stay active and feel good' },
];

const EXPERIENCE: { key: ExpKey; label: string; sub: string }[] = [
  { key: 'beginner',      label: 'Beginner',      sub: 'Less than 1 year training' },
  { key: 'intermediate',  label: 'Intermediate',  sub: '1–3 years consistent training' },
  { key: 'advanced',      label: 'Advanced',      sub: '3+ years, structured programming' },
];

export default function StepGoalsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [experience, setExperience] = useState<ExpKey | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!goal) { Alert.alert('Select a training goal'); return; }
    if (!experience) { Alert.alert('Select your experience level'); return; }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ goal, experience_level: experience })
      .eq('id', user.id);

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }

    router.push('/onboarding/step-plan');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <StepDots current={3} Colors={Colors} />

      <Text style={styles.heading}>Your Training Goals</Text>
      <Text style={styles.sub}>We'll use this to tailor your experience.</Text>

      <Text style={styles.sectionLabel}>Primary Goal</Text>
      {GOALS.map(item => {
        const selected = goal === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => setGoal(item.key)}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioInner} />}
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{item.label}</Text>
              <Text style={styles.cardSub}>{item.sub}</Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Experience Level</Text>
      {EXPERIENCE.map(item => {
        const selected = experience === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => setExperience(item.key)}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioInner} />}
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{item.label}</Text>
              <Text style={styles.cardSub}>{item.sub}</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.primaryBtn, saving && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Continue'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function StepDots({ current, Colors }: { current: number; Colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing.xl }}>
      {[1, 2, 3, 4].map(n => (
        <View
          key={n}
          style={{
            height: 8, borderRadius: 4,
            width: n === current ? 24 : 8,
            backgroundColor: n <= current ? Colors.primary : Colors.border,
            opacity: n < current ? 0.5 : 1,
          }}
        />
      ))}
    </View>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  heading: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    gap: Spacing.md,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardText: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  cardTitleSelected: { color: Colors.primary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  primaryBtn: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
