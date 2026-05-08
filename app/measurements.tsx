// app/measurements.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

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
  const [values, setValues] = useState<FieldValues>({});
  const [history, setHistory] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(10);
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
    const { error } = await supabase.from('measurements').insert(payload);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setValues({});
      await loadHistory();
    }
    setSaving(false);
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

      <Text style={styles.title}>Measurements</Text>
      <Text style={styles.subtitle}>All measurements in inches</Text>

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
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      ) : history.length === 0 ? (
        <Text style={styles.emptyText}>No measurements recorded yet</Text>
      ) : (
        history.map(entry => {
          const populated = FIELDS.filter(f => entry[f.key] != null);
          return (
            <View key={entry.id} style={styles.historyCard}>
              <Text style={styles.historyDate}>
                {new Date(entry.date).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
              <View style={styles.historyGrid}>
                {populated.map(f => (
                  <View key={f.key} style={styles.historyCell}>
                    <Text style={styles.historyCellLabel}>{f.label}</Text>
                    <Text style={styles.historyCellValue}>{entry[f.key]}"</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: {
    fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl,
  },

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
  fieldLabel: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    fontWeight: '500', marginBottom: Spacing.xs,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: Spacing.sm,
    color: Colors.text, fontSize: FontSize.md,
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
  emptyText: {
    color: Colors.textSecondary, fontSize: FontSize.md,
    textAlign: 'center', marginTop: Spacing.lg,
  },

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
  },
  historyCellLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500',
  },
  historyCellValue: {
    fontSize: FontSize.sm, color: Colors.text, fontWeight: '600',
  },
});
