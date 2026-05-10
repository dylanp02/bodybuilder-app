// app/measurements.tsx — log body measurements (inches) and view per-field trend charts
// Pro feature — gated by DEV_PRO_UNLOCKED in lib/proAccess.ts (currently true for dev).
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import LineChart, { ChartPoint } from '../components/LineChart';
import { formatLongDate } from '../lib/utils';
import { DEV_PRO_UNLOCKED } from '../lib/proAccess';

const FIELDS: { key: string; label: string }[] = [
  { key: 'neck_in',      label: 'Neck' },
  { key: 'chest_in',     label: 'Chest' },
  { key: 'shoulders_in', label: 'Shoulders' },
  { key: 'biceps_in',    label: 'Biceps' },
  { key: 'forearms_in',  label: 'Forearms' },
  { key: 'thighs_in',    label: 'Thighs' },
  { key: 'calves_in',    label: 'Calves' },
  { key: 'waist_in',     label: 'Waist' },
  { key: 'hips_in',      label: 'Hips' },
];

type FieldValues = Record<string, string>;
type MeasurementRow = { id: string; date: string } & Record<string, number | null>;

export default function MeasurementsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [values, setValues]   = useState<FieldValues>({});
  const [history, setHistory] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // expandedKey = `${entryId}-${fieldKey}` — one chip open at a time
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('measurements')
      // Fetch all columns needed for display and charting across all history
      .select('id, date, neck_in, chest_in, shoulders_in, biceps_in, forearms_in, thighs_in, calves_in, waist_in, hips_in')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (data) setHistory(data as MeasurementRow[]);
    setLoading(false);
  };

  const saveEntry = async () => {
    const hasAny = FIELDS.some(f => values[f.key]?.trim());
    if (!hasAny) { Alert.alert('Enter at least one measurement'); return; }
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const today = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = { user_id: user.id, date: today };
    for (const f of FIELDS) {
      const raw = values[f.key];
      payload[f.key] = raw?.trim() ? parseFloat(raw) : null;
    }
    const { error } = await supabase
      .from('measurements')
      .upsert(payload, { onConflict: 'user_id,date' });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setValues({});
      await loadHistory();
    }
    setSaving(false);
  };

  // Build chart points for a field across all history entries (oldest → newest)
  const chartPointsFor = (fieldKey: string): ChartPoint[] =>
    [...history]
      .reverse()
      .filter(e => e[fieldKey] != null)
      .map(e => ({ date: e.date, value: e[fieldKey] as number }));

  const toggleExpanded = (entryId: string, fieldKey: string) => {
    const key = `${entryId}-${fieldKey}`;
    setExpandedKey(prev => (prev === key ? null : key));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Measurements</Text>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
        {DEV_PRO_UNLOCKED && (
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>DEV</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>All measurements in inches</Text>

      {/* Entry form */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Log Today's Measurements</Text>
        <View style={styles.grid}>
          {FIELDS.map(f => (
            <View key={f.key} style={styles.gridCell}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="—"
                placeholderTextColor={Colors.textDisabled}
                value={values[f.key] ?? ''}
                onChangeText={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={saveEntry}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? 'Saving...' : 'Save Measurements'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>History</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : history.length === 0 ? (
        <Text style={styles.emptyText}>No measurements recorded yet</Text>
      ) : (
        history.map(entry => {
          const populated = FIELDS.filter(f => entry[f.key] != null);
          return (
            <View key={entry.id} style={styles.historyCard}>
              <Text style={styles.historyDate}>{formatLongDate(entry.date)}</Text>

              <View style={styles.historyGrid}>
                {populated.map(f => {
                  const chipKey = `${entry.id}-${f.key}`;
                  const isOpen  = expandedKey === chipKey;
                  return (
                    <Pressable
                      key={f.key}
                      style={[styles.historyCell, isOpen && styles.historyCellActive]}
                      onPress={() => toggleExpanded(entry.id, f.key)}
                    >
                      <Text style={[styles.historyCellLabel, isOpen && styles.historyCellLabelActive]}>
                        {f.label}
                      </Text>
                      <Text style={[styles.historyCellValue, isOpen && styles.historyCellValueActive]}>
                        {entry[f.key]}"
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Expanded trend chart — shown when a chip in this card is tapped */}
              {populated.some(f => expandedKey === `${entry.id}-${f.key}`) && (() => {
                const activeField = FIELDS.find(f => expandedKey === `${entry.id}-${f.key}`)!;
                const pts = chartPointsFor(activeField.key);
                return (
                  <View style={styles.chartExpand}>
                    <Text style={styles.chartExpandLabel}>
                      {activeField.label} over time
                    </Text>
                    {pts.length < 2 ? (
                      <Text style={styles.chartNotEnoughData}>
                        Need at least 2 entries to show a trend.
                      </Text>
                    ) : (
                      <LineChart
                        points={pts}
                        color={Colors.primary}
                        height={150}
                        yFormat={v => `${v.toFixed(1)}"`}
                        gridCount={3}
                      />
                    )}
                  </View>
                );
              })()}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  proBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  proBadgeText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
  devBadge: {
    backgroundColor: Colors.warning + '33', borderRadius: Radius.sm,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.warning,
  },
  devBadgeText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '700' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -Spacing.xs },
  gridCell: { width: '50%', paddingHorizontal: Spacing.xs, marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: Spacing.sm, color: Colors.text, fontSize: FontSize.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },

  sectionTitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  loader: { marginTop: Spacing.lg },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', marginTop: Spacing.lg },

  historyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  historyDate: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    fontWeight: '600', marginBottom: Spacing.sm,
  },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  historyCell: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  historyCellActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  historyCellLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  historyCellLabelActive: { color: 'rgba(255,255,255,0.75)' },
  historyCellValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  historyCellValueActive: { color: '#fff' },

  chartExpand: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chartExpandLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  chartNotEnoughData: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: Spacing.xs },
});
