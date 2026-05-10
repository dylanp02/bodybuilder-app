// app/top-sets.tsx — log pre-app personal bests for exercises (1RM or working sets)
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import { Exercise, MuscleGroup } from '../lib/types';
import { MUSCLE_GROUPS, EQUIPMENT_FILTERS } from '../lib/constants';

type SetType = '1rm' | 'working';

interface TopSet {
  id: string;
  set_type: SetType;
  reps: number | null;
  weight_lbs: number;
  exercises: { name: string; muscle_group: string };
}

export default function TopSetsScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [topSets, setTopSets] = useState<TopSet[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | MuscleGroup>('all');
  const [activeEquipment, setActiveEquipment] = useState('all');

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [setType, setSetType] = useState<SetType>('1rm');
  const [reps, setReps] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExercises();
    loadTopSets();
  }, []);

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment, is_compound, notes')
      .order('name');
    if (data) setExercises(data as Exercise[]);
  };

  const loadTopSets = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('top_sets')
      .select('id, set_type, reps, weight_lbs, exercises(name, muscle_group)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setTopSets(data as unknown as TopSet[]);
    setLoading(false);
  };

  const filteredExercises = useMemo(() => {
    const byGroup = activeTab === 'all'
      ? exercises
      : exercises.filter(e => e.muscle_group.toLowerCase() === activeTab.toLowerCase());
    return activeEquipment === 'all'
      ? byGroup
      : byGroup.filter(e => (e.equipment ?? '').toLowerCase() === activeEquipment.toLowerCase());
  }, [exercises, activeTab, activeEquipment]);

  const selectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    setShowPicker(false);
    setReps('');
    setWeightLbs('');
    setSetType('1rm');
  };

  const saveTopSet = async () => {
    if (!selectedExercise) return;
    const w = parseFloat(weightLbs);
    if (!w || w <= 0) { Alert.alert('Enter a valid weight'); return; }
    if (setType === 'working' && !reps.trim()) { Alert.alert('Enter reps for a working set'); return; }
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('top_sets').insert({
      user_id: user.id,
      exercise_id: selectedExercise.id,
      set_type: setType,
      reps: setType === '1rm' ? 1 : (parseInt(reps) || null),
      weight_lbs: w,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSelectedExercise(null);
      setReps('');
      setWeightLbs('');
      await loadTopSets();
    }
    setSaving(false);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Top Sets</Text>
        <Text style={styles.subtitle}>
          Record personal bests from before you started tracking
        </Text>

        {selectedExercise ? (
          <View style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <View style={styles.formCardLeft}>
                <Text style={styles.exerciseName}>{selectedExercise.name}</Text>
                <Text style={styles.muscleGroup}>{selectedExercise.muscle_group}</Text>
              </View>
              <Pressable onPress={() => setSelectedExercise(null)}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(['1rm', 'working'] as SetType[]).map(t => (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, setType === t && styles.typeBtnActive]}
                  onPress={() => setSetType(t)}
                >
                  <Text style={[styles.typeBtnText, setType === t && styles.typeBtnTextActive]}>
                    {t === '1rm' ? '1 Rep Max' : 'Working Set'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {setType === 'working' && (
              <>
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5"
                  placeholderTextColor={Colors.textDisabled}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 225"
              placeholderTextColor={Colors.textDisabled}
              value={weightLbs}
              onChangeText={setWeightLbs}
              keyboardType="decimal-pad"
            />

            <Pressable
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={saveTopSet}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Saving...' : 'Save Top Set'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowPicker(true)}>
            <Text style={styles.addButtonText}>+ Select Exercise</Text>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : topSets.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recorded Top Sets</Text>
            {topSets.map(ts => (
              <View key={ts.id} style={styles.topSetRow}>
                <View style={styles.topSetLeft}>
                  <Text style={styles.tsExercise}>{ts.exercises.name}</Text>
                  <Text style={styles.tsMeta}>
                    {ts.set_type === '1rm'
                      ? `1RM · ${ts.weight_lbs} lbs`
                      : `${ts.reps ?? '?'} reps · ${ts.weight_lbs} lbs`}
                  </Text>
                </View>
                <View style={[styles.pill, ts.set_type === '1rm' ? styles.pill1RM : styles.pillWorking]}>
                  <Text style={styles.pillText}>
                    {ts.set_type === '1rm' ? '1RM' : 'Working'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.filterRowWrap}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRowContent}
              style={styles.tabRow}
            >
              {MUSCLE_GROUPS.map(g => (
                <Pressable
                  key={g.key}
                  style={[styles.tab, activeTab === g.key && styles.tabActive]}
                  onPress={() => { setActiveTab(g.key); setActiveEquipment('all'); }}
                >
                  <Text style={[styles.tabText, activeTab === g.key && styles.tabTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterRowWrap}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRowContent}
              style={styles.tabRow}
            >
              {EQUIPMENT_FILTERS.map(eq => (
                <Pressable
                  key={eq}
                  style={[styles.tab, activeEquipment === eq && styles.tabActive]}
                  onPress={() => setActiveEquipment(eq)}
                >
                  <Text style={[styles.tabText, activeEquipment === eq && styles.tabTextActive]}>
                    {eq === 'all' ? 'All' : eq}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id}
            style={styles.exerciseList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.pickerItem} onPress={() => selectExercise(item)}>
                <Text style={styles.pickerItemText}>{item.name}</Text>
                <Text style={styles.pickerItemSub}>
                  {item.muscle_group}{item.equipment ? ` · ${item.equipment}` : ''}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No exercises in this group</Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },

  addButton: {
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: Radius.md, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.xl,
  },
  addButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },

  formCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  formCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.md,
  },
  formCardLeft: { flex: 1 },
  topSetLeft: { flex: 1 },
  exerciseName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  muscleGroup: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2,
  },
  changeLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },

  sectionTitle: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.sm, marginTop: Spacing.sm,
  },
  topSetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  tsExercise: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  tsMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  pill1RM: { backgroundColor: Colors.primary },
  pillWorking: { backgroundColor: Colors.success },
  pillText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },

  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  modalClose: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  filterRowWrap: { height: 36, marginBottom: 8 },
  tabRow: { height: 36, flexGrow: 0, flexShrink: 0 },
  tabRowContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  tab: {
    height: 36, paddingHorizontal: 14, paddingVertical: 0, borderRadius: 0,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  exerciseList: { flex: 1 },
  pickerItem: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemText: { color: Colors.text, fontSize: FontSize.md },
  pickerItemSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  emptyText: {
    color: Colors.textSecondary, fontSize: FontSize.md,
    textAlign: 'center', paddingVertical: Spacing.xl,
  },
});
