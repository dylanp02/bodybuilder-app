/*
 * REQUIRES A DEVELOPMENT BUILD — see lib/notifications.ts for full context.
 *
 * This screen manages notification preferences stored in AsyncStorage. Preference
 * reads/writes work in Expo Go. The reschedule calls (forceRescheduleNotifications)
 * are no-ops in Expo Go but fully functional in a development build.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from '../lib/notifPrefs';
import { forceRescheduleNotifications } from '../lib/notifications';

const MORNING_HOURS = [6, 7, 8, 9, 10];
const AFTERNOON_HOURS = [13, 14, 15, 16, 17, 18];

function fmt12(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${suffix}`;
}

function cycleHour(hours: number[], current: number, dir: 1 | -1): number {
  const idx = hours.indexOf(current);
  const safe = idx < 0 ? 0 : idx;
  return hours[(safe + dir + hours.length) % hours.length];
}

export default function NotificationsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getNotifPrefs().then(setPrefs); }, []);

  const update = useCallback(async (updates: Partial<NotifPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...updates };
    setPrefs(next);
    setSaving(true);
    await setNotifPrefs(updates);
    await forceRescheduleNotifications();
    setSaving(false);
  }, [prefs]);

  if (!prefs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const deviceActive = prefs.deviceEnabled && !prefs.deviceMuted;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Notifications</Text>

      {/* ── Device ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Device</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Enable notifications</Text>
            <Text style={styles.rowSub}>Workout reminders and bodyweight alerts</Text>
          </View>
          <Switch
            value={prefs.deviceEnabled}
            onValueChange={v => update({ deviceEnabled: v, deviceMuted: v ? prefs.deviceMuted : false })}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.row, styles.rowDivider, !prefs.deviceEnabled && styles.rowFaded]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Mute</Text>
            <Text style={styles.rowSub}>Pause all device notifications temporarily</Text>
          </View>
          <Switch
            value={prefs.deviceMuted}
            onValueChange={v => update({ deviceMuted: v })}
            disabled={!prefs.deviceEnabled}
            trackColor={{ false: Colors.border, true: Colors.textSecondary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* ── Reminder times ── */}
      <View style={[styles.section, !deviceActive && styles.sectionFaded]}>
        <Text style={styles.sectionLabel}>Reminder Times</Text>

        <View style={styles.timeRow}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Morning</Text>
            <Text style={styles.rowSub}>Bodyweight &amp; training reminders (6–10 AM)</Text>
          </View>
          <View style={styles.timePicker}>
            <Pressable
              style={styles.arrow}
              onPress={() => update({ morningHour: cycleHour(MORNING_HOURS, prefs.morningHour, -1) })}
              disabled={!deviceActive}
            >
              <Text style={[styles.arrowText, !deviceActive && styles.textFaded]}>‹</Text>
            </Pressable>
            <Text style={[styles.timeValue, !deviceActive && styles.textFaded]}>
              {fmt12(prefs.morningHour)}
            </Text>
            <Pressable
              style={styles.arrow}
              onPress={() => update({ morningHour: cycleHour(MORNING_HOURS, prefs.morningHour, 1) })}
              disabled={!deviceActive}
            >
              <Text style={[styles.arrowText, !deviceActive && styles.textFaded]}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.timeRow}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Afternoon</Text>
            <Text style={styles.rowSub}>Training reminder on workout days (1–6 PM)</Text>
          </View>
          <View style={styles.timePicker}>
            <Pressable
              style={styles.arrow}
              onPress={() => update({ afternoonHour: cycleHour(AFTERNOON_HOURS, prefs.afternoonHour, -1) })}
              disabled={!deviceActive}
            >
              <Text style={[styles.arrowText, !deviceActive && styles.textFaded]}>‹</Text>
            </Pressable>
            <Text style={[styles.timeValue, !deviceActive && styles.textFaded]}>
              {fmt12(prefs.afternoonHour)}
            </Text>
            <Pressable
              style={styles.arrow}
              onPress={() => update({ afternoonHour: cycleHour(AFTERNOON_HOURS, prefs.afternoonHour, 1) })}
              disabled={!deviceActive}
            >
              <Text style={[styles.arrowText, !deviceActive && styles.textFaded]}>›</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── What you'll receive ── */}
      <View style={[styles.section, !deviceActive && styles.sectionFaded]}>
        <Text style={styles.sectionLabel}>What you'll receive</Text>
        {[
          { label: 'Training days', detail: 'Morning + afternoon reminders with your scheduled muscle groups' },
          { label: 'Rest days', detail: 'Single morning reminder to recover and prepare' },
          { label: 'Bodyweight', detail: 'Weekly nudge if you haven\'t logged in over 5 days' },
        ].map((item, i, arr) => (
          <View key={item.label} style={[styles.infoRow, i < arr.length - 1 && styles.rowDivider]}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoDetail}>{item.detail}</Text>
          </View>
        ))}
      </View>

      {/* ── Email ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Email</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Email reminders</Text>
            <Text style={styles.rowSub}>Receive reminders via email (coming soon)</Text>
          </View>
          <Switch
            value={false}
            disabled
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.emailNote}>
          <Text style={styles.emailNoteText}>
            Email delivery will be available in a future update.
          </Text>
        </View>
      </View>

      {saving && (
        <Text style={styles.savingText}>Updating reminders…</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xl * 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionFaded: { opacity: 0.45 },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  rowFaded: { opacity: 0.4 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  rowLeft: { flex: 1, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  arrow: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  arrowText: { fontSize: 24, color: Colors.primary, fontWeight: '600', lineHeight: 28 },
  timeValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, minWidth: 76, textAlign: 'center' },
  textFaded: { color: Colors.textDisabled },

  infoRow: { paddingVertical: Spacing.sm },
  infoLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  infoDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },

  emailNote: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    padding: Spacing.md, marginTop: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  emailNoteText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  savingText: { textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.md },
});
