// app/settings.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from '../lib/notifPrefs';
import { forceRescheduleNotifications } from '../lib/notifications';
import { getCurrentUser, supabase } from '../lib/supabase';
import { TrainingPlan } from '../lib/types';

export default function SettingsScreen() {
  const { colors: Colors, isDark, isMetric, toggleTheme, setMetric } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // Notification prefs state
  const [prefs, setPrefsState] = useState<NotifPrefs | null>(null);
  const [userId, setUserId]    = useState<string | null>(null);
  const [plan, setPlan]        = useState<TrainingPlan | null>(null);

  useEffect(() => {
    async function load() {
      const [loadedPrefs, user] = await Promise.all([
        getNotifPrefs(),
        getCurrentUser(),
      ]);
      setPrefsState(loadedPrefs);
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('training_plans')
        .select('id, user_id, plan_type, plan_name, duration_weeks, start_date, schedule, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setPlan(data as TrainingPlan | null);
    }
    load();
  }, []);

  async function updatePref<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
    if (!prefs || !userId) return;
    const updated = { ...prefs, [key]: value };
    setPrefsState(updated);
    await setNotifPrefs({ [key]: value });
    forceRescheduleNotifications(userId, plan);
  }

  function formatHour(h: number): string {
    if (h === 12) return '12 PM';
    if (h > 12)   return `${h - 12} PM`;
    return `${h} AM`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Settings</Text>

      {/* Units */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Units</Text>
        <Text style={styles.rowSub}>Used for weights and measurements</Text>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segHalf, styles.segLeft, !isMetric && styles.segActive]}
            onPress={() => setMetric(false)}
          >
            <Text style={[styles.segText, !isMetric && styles.segTextActive]}>Imperial</Text>
            <Text style={[styles.segSubText, !isMetric && styles.segSubTextActive]}>lbs, in</Text>
          </Pressable>
          <Pressable
            style={[styles.segHalf, styles.segRight, isMetric && styles.segActive]}
            onPress={() => setMetric(true)}
          >
            <Text style={[styles.segText, isMetric && styles.segTextActive]}>Metric</Text>
            <Text style={[styles.segSubText, isMetric && styles.segSubTextActive]}>kg, cm</Text>
          </Pressable>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>

        {prefs === null ? (
          <Text style={styles.rowSub}>Loading…</Text>
        ) : (
          <>
            {/* Bodyweight reminder toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>Bodyweight reminders</Text>
                <Text style={styles.rowSub}>Weekly reminder when you haven't logged in 5+ days</Text>
              </View>
              <Switch
                value={prefs.bodyweightEnabled}
                onValueChange={v => updatePref('bodyweightEnabled', v)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Training notifications toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>Training day notifications</Text>
                <Text style={styles.rowSub}>Morning and afternoon reminders on plan days</Text>
              </View>
              <Switch
                value={prefs.trainingEnabled}
                onValueChange={v => updatePref('trainingEnabled', v)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Morning hour */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>Morning notification</Text>
                <Text style={styles.rowSub}>6 AM – 10 AM</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepBtn, prefs.morningHour <= 6 && styles.stepBtnDisabled]}
                  onPress={() => prefs.morningHour > 6 && updatePref('morningHour', prefs.morningHour - 1)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={[styles.stepValue, { color: Colors.text }]}>
                  {formatHour(prefs.morningHour)}
                </Text>
                <Pressable
                  style={[styles.stepBtn, prefs.morningHour >= 10 && styles.stepBtnDisabled]}
                  onPress={() => prefs.morningHour < 10 && updatePref('morningHour', prefs.morningHour + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Afternoon hour */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>Afternoon notification</Text>
                <Text style={styles.rowSub}>1 PM – 6 PM</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepBtn, prefs.afternoonHour <= 13 && styles.stepBtnDisabled]}
                  onPress={() => prefs.afternoonHour > 13 && updatePref('afternoonHour', prefs.afternoonHour - 1)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={[styles.stepValue, { color: Colors.text }]}>
                  {formatHour(prefs.afternoonHour)}
                </Text>
                <Pressable
                  style={[styles.stepBtn, prefs.afternoonHour >= 18 && styles.stepBtnDisabled]}
                  onPress={() => prefs.afternoonHour < 18 && updatePref('afternoonHour', prefs.afternoonHour + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Text style={styles.rowSub}>Changes immediately</Text>
          </View>
          <Switch
            value={!isDark}
            onValueChange={() => toggleTheme()}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Developer (dev builds only) */}
      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Developer</Text>
          <Pressable style={styles.navRow} onPress={() => router.push('/debug')}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Debug Info</Text>
              <Text style={styles.rowSub}>Pro status, auth, RevenueCat</Text>
            </View>
            <Text style={styles.navChevron}>›</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: {
    fontSize: FontSize.xl, fontWeight: '700',
    color: Colors.text, marginBottom: Spacing.xl,
  },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flex: 1, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navChevron: { fontSize: 22, color: Colors.textDisabled, lineHeight: 26 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontSize: 18, color: Colors.primary, fontWeight: '700', lineHeight: 22 },
  stepValue: { fontSize: FontSize.sm, fontWeight: '600', minWidth: 52, textAlign: 'center' },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  segHalf: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  segLeft: { borderRightWidth: 1, borderRightColor: Colors.border },
  segRight: {},
  segActive: { backgroundColor: Colors.primary },
  segText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  segTextActive: { color: '#fff' },
  segSubText: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  segSubTextActive: { color: 'rgba(255,255,255,0.75)' },
});
