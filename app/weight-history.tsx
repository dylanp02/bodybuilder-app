// app/weight-history.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

interface WeightLog {
  id: string;
  weight_lbs: number;
  date: string;
}

export default function WeightHistoryScreen() {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('weight_logs')
      .select('id, weight_lbs, date')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (data) setLogs(data as WeightLog[]);
    setLoading(false);
  };

  const logWeight = async () => {
    const val = parseFloat(weight);
    if (!val || val <= 0) { Alert.alert('Enter a valid weight'); return; }
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('weight_logs')
      .insert({ user_id: user.id, weight_lbs: val, date: today });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setWeight('');
      await loadLogs();
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Body Weight</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Log Today's Weight</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 185.5"
            placeholderTextColor={Colors.textDisabled}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <Text style={styles.unit}>lbs</Text>
          <Pressable
            style={[styles.logButton, saving && styles.buttonDisabled]}
            onPress={logWeight}
            disabled={saving}
          >
            <Text style={styles.logButtonText}>{saving ? '...' : 'Log'}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>History</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      ) : logs.length === 0 ? (
        <Text style={styles.emptyText}>No weight entries yet</Text>
      ) : (
        logs.map(log => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logDate}>
              {new Date(log.date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
            <Text style={styles.logWeight}>{log.weight_lbs} lbs</Text>
          </View>
        ))
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
    fontSize: FontSize.xl, fontWeight: '700',
    color: Colors.text, marginBottom: Spacing.xl,
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md,
  },
  unit: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  logButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  buttonDisabled: { opacity: 0.6 },
  logButtonText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  sectionTitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary, fontSize: FontSize.md,
    textAlign: 'center', marginTop: Spacing.lg,
  },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  logDate: { fontSize: FontSize.md, color: Colors.text },
  logWeight: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
});
