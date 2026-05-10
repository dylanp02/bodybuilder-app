import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function StepPlanScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [saving, setSaving] = useState(false);

  const complete = async (destination: '/(tabs)' | '/(tabs)/planner') => {
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id);

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }

    router.replace(destination);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <StepDots current={4} Colors={Colors} />

      <Text style={styles.heading}>You're all set</Text>
      <Text style={styles.sub}>
        How would you like to get started?
      </Text>

      <Pressable
        style={[styles.card, styles.cardPrimary, saving && styles.btnDisabled]}
        onPress={() => complete('/(tabs)/planner')}
        disabled={saving}
      >
        <Text style={styles.cardPrimaryLabel}>Set up my training program</Text>
        <Text style={styles.cardPrimarySub}>
          Build a weekly or cycle plan before you start logging
        </Text>
      </Pressable>

      <Pressable
        style={[styles.card, saving && styles.btnDisabled]}
        onPress={() => complete('/(tabs)')}
        disabled={saving}
      >
        <Text style={styles.cardLabel}>Explore first</Text>
        <Text style={styles.cardSub}>
          Log workouts and set up a training plan whenever you're ready
        </Text>
      </Pressable>

      {saving && <Text style={styles.savingText}>Setting up your account…</Text>}
    </View>
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
  container: {
    flex: 1, backgroundColor: Colors.background,
    padding: Spacing.lg, paddingTop: Spacing.xl,
  },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  heading: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardPrimary: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  cardPrimaryLabel: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardPrimarySub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
  cardLabel: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  btnDisabled: { opacity: 0.6 },
  savingText: {
    textAlign: 'center', color: Colors.textSecondary,
    fontSize: FontSize.sm, marginTop: Spacing.lg,
  },
});
