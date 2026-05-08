// app/(tabs)/workout.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, Modal, FlatList, Switch,
} from 'react-native';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { Exercise, MuscleGroup } from '../../lib/types';

interface PendingSet {
  exercise: Exercise;
  setNumber: number;
  reps: string;
  weight: string;
}

const MUSCLE_GROUPS: { key: 'all' | MuscleGroup; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'chest',     label: 'Chest' },
  { key: 'back',      label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps',    label: 'Biceps' },
  { key: 'triceps',   label: 'Triceps' },
  { key: 'legs',      label: 'Legs' },
  { key: 'glutes',    label: 'Glutes' },
  { key: 'core',      label: 'Core' },
  { key: 'cardio',    label: 'Cardio' },
];

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [pendingSets, setPendingSets] = useState<PendingSet[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  // Picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | MuscleGroup>('all');

  // Create exercise form (shown inside picker)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState<MuscleGroup>('chest');
  const [newEquipment, setNewEquipment] = useState('');
  const [newIsCompound, setNewIsCompound] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadExercises(); }, []);

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').order('name');
    if (data) setExercises(data);
  };

  const [activeEquipment, setActiveEquipment] = useState('all');

  // Equipment options derived from whichever muscle group is active
  const equipmentOptions = useMemo(() => {
    const base = activeTab === 'all' ? exercises : exercises.filter(e => e.muscle_group === activeTab);
    const seen = new Set<string>();
    for (const ex of base) { if (ex.equipment) seen.add(ex.equipment); }
    return ['all', ...Array.from(seen).sort()];
  }, [exercises, activeTab]);

  const filteredExercises = useMemo(() => {
    const byGroup = activeTab === 'all' ? exercises : exercises.filter(e => e.muscle_group === activeTab);
    return activeEquipment === 'all' ? byGroup : byGroup.filter(e => e.equipment === activeEquipment);
  }, [exercises, activeTab, activeEquipment]);

  // Pending sets grouped by exercise, preserving insertion order
  const exerciseGroups = useMemo(() => {
    const groups = new Map<string, { exercise: Exercise; sets: PendingSet[] }>();
    for (const set of pendingSets) {
      if (!groups.has(set.exercise.id)) {
        groups.set(set.exercise.id, { exercise: set.exercise, sets: [] });
      }
      groups.get(set.exercise.id)!.sets.push(set);
    }
    return Array.from(groups.values());
  }, [pendingSets]);

  const openPicker = () => {
    setShowCreateForm(false);
    setShowPicker(true);
  };

  const selectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    setReps('');
    setWeight('');
    setShowPicker(false);
    setShowCreateForm(false);
  };

  const addSet = () => {
    if (!selectedExercise) return;
    if (!reps) { Alert.alert('Enter reps'); return; }
    const existingCount = pendingSets.filter(s => s.exercise.id === selectedExercise.id).length;
    setPendingSets(prev => [...prev, {
      exercise: selectedExercise,
      setNumber: existingCount + 1,
      reps,
      weight,
    }]);
    setReps('');
    setWeight('');
  };

  const removeSet = (setRef: PendingSet) => {
    setPendingSets(prev => prev.filter(s => s !== setRef));
  };

  const createExercise = async () => {
    if (!newName.trim()) { Alert.alert('Enter exercise name'); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: newName.trim(),
        muscle_group: newMuscleGroup,
        equipment: newEquipment.trim() || null,
        is_compound: newIsCompound,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setExercises(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewEquipment('');
      setNewIsCompound(false);
      selectExercise(data);
    }
    setCreating(false);
  };

  const saveWorkout = async () => {
    if (!workoutName) { Alert.alert('Name your workout'); return; }
    if (pendingSets.length === 0) { Alert.alert('Log at least one set'); return; }
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: workoutName, date: today })
      .select()
      .single();

    if (workoutError || !workout) {
      Alert.alert('Error saving workout', workoutError?.message);
      setSaving(false);
      return;
    }

    const { error: setsError } = await supabase.from('workout_sets').insert(
      pendingSets.map(s => ({
        workout_id: workout.id,
        exercise_id: s.exercise.id,
        set_number: s.setNumber,
        reps: parseInt(s.reps) || null,
        weight_lbs: parseFloat(s.weight) || null,
      }))
    );

    if (setsError) {
      Alert.alert('Error saving sets', setsError.message);
    } else {
      Alert.alert('Workout saved! 💪', `${pendingSets.length} sets logged.`);
      setWorkoutName('');
      setPendingSets([]);
      setSelectedExercise(null);
    }
    setSaving(false);
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Log Workout</Text>

        <TextInput
          style={styles.input}
          placeholder='Workout name (e.g. "Push Day A")'
          placeholderTextColor={Colors.textDisabled}
          value={workoutName}
          onChangeText={setWorkoutName}
        />

        {/* Active exercise card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Current Exercise</Text>
          <Pressable style={styles.exercisePickerRow} onPress={openPicker}>
            <Text style={[styles.exercisePickerText, !selectedExercise && styles.exercisePickerPlaceholder]}>
              {selectedExercise ? selectedExercise.name : 'Select Exercise'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {selectedExercise && (
            <>
              <View style={styles.setInputRow}>
                <TextInput
                  style={[styles.input, styles.setInput]}
                  placeholder="Reps"
                  placeholderTextColor={Colors.textDisabled}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.setInput]}
                  placeholder="Weight (lbs)"
                  placeholderTextColor={Colors.textDisabled}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
                <Pressable style={styles.addSetButton} onPress={addSet}>
                  <Text style={styles.addSetButtonText}>+ Set</Text>
                </Pressable>
              </View>

              {pendingSets
                .filter(s => s.exercise.id === selectedExercise.id)
                .map((set, idx) => (
                  <View key={idx} style={styles.setRow}>
                    <Text style={styles.setDetail}>
                      Set {set.setNumber} · {set.reps} reps{set.weight ? ` · ${set.weight} lbs` : ''}
                    </Text>
                    <Pressable onPress={() => removeSet(set)}>
                      <Text style={styles.removeSet}>✕</Text>
                    </Pressable>
                  </View>
                ))
              }
            </>
          )}
        </View>

        {/* Previously logged exercises (all except the active one) */}
        {exerciseGroups
          .filter(g => g.exercise.id !== selectedExercise?.id)
          .map(group => (
            <View key={group.exercise.id} style={styles.card}>
              <View style={styles.groupHeader}>
                <Text style={styles.cardLabel}>{group.exercise.name}</Text>
                <Pressable onPress={() => selectExercise(group.exercise)}>
                  <Text style={styles.resumeText}>Resume</Text>
                </Pressable>
              </View>
              {group.sets.map((set, idx) => (
                <View key={idx} style={styles.setRow}>
                  <Text style={styles.setDetail}>
                    Set {set.setNumber} · {set.reps} reps{set.weight ? ` · ${set.weight} lbs` : ''}
                  </Text>
                  <Pressable onPress={() => removeSet(set)}>
                    <Text style={styles.removeSet}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        }

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveWorkout}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Workout'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Exercise Picker Modal ── */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {showCreateForm ? 'New Exercise' : 'Select Exercise'}
            </Text>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>

          {showCreateForm ? (
            <ScrollView
              style={styles.createForm}
              contentContainerStyle={styles.createFormContent}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.input}
                placeholder="Exercise name"
                placeholderTextColor={Colors.textDisabled}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Muscle Group</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabRowContent}
                style={styles.tabRow}
              >
                {MUSCLE_GROUPS.filter(g => g.key !== 'all').map(g => (
                  <Pressable
                    key={g.key}
                    style={[styles.tab, newMuscleGroup === g.key && styles.tabActive]}
                    onPress={() => setNewMuscleGroup(g.key as MuscleGroup)}
                  >
                    <Text style={[styles.tabText, newMuscleGroup === g.key && styles.tabTextActive]}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                style={[styles.input, { marginTop: Spacing.md }]}
                placeholder="Equipment (e.g. Barbell, Dumbbell)"
                placeholderTextColor={Colors.textDisabled}
                value={newEquipment}
                onChangeText={setNewEquipment}
              />

              <View style={styles.compoundRow}>
                <Text style={styles.compoundLabel}>Compound movement</Text>
                <Switch
                  value={newIsCompound}
                  onValueChange={setNewIsCompound}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              <Pressable
                style={[styles.saveButton, creating && styles.saveButtonDisabled]}
                onPress={createExercise}
                disabled={creating}
              >
                <Text style={styles.saveButtonText}>
                  {creating ? 'Creating...' : 'Create & Select'}
                </Text>
              </Pressable>

              <Pressable style={styles.backButton} onPress={() => setShowCreateForm(false)}>
                <Text style={styles.backButtonText}>← Back to list</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
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

              {activeTab !== 'cardio' && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabRowContent}
                  style={styles.tabRow}
                >
                  {equipmentOptions.map(eq => (
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
              )}

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
                  <Text style={styles.emptyText}>No exercises in this group yet</Text>
                }
              />

              <View style={styles.createButtonWrap}>
                <Pressable style={styles.createButton} onPress={() => setShowCreateForm(true)}>
                  <Text style={styles.createButtonText}>+ Create New Exercise</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl + Spacing.lg },
  screenTitle: {
    fontSize: FontSize.xl, fontWeight: '700',
    color: Colors.text, marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  exercisePickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  exercisePickerText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  exercisePickerPlaceholder: { color: Colors.textSecondary },
  chevron: { color: Colors.textSecondary, fontSize: FontSize.xl, lineHeight: FontSize.xl },
  setInputRow: {
    flexDirection: 'row', gap: Spacing.sm,
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  setInput: { flex: 1, marginBottom: 0 },
  addSetButton: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, borderRadius: Radius.md,
  },
  addSetButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
  setRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  setDetail: { color: Colors.textSecondary, fontSize: FontSize.sm },
  removeSet: { color: Colors.danger, fontSize: FontSize.md, paddingLeft: Spacing.md },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  resumeText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  saveButton: {
    backgroundColor: Colors.primary, padding: Spacing.lg,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  modalClose: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  tabRow: { height: 56, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRowContent: {
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    gap: Spacing.xs, alignItems: 'center',
  },
  tab: {
    height: 36, paddingHorizontal: 14, paddingVertical: 0,
    borderRadius: 0, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
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
  createButtonWrap: {
    padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  createButton: {
    backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary,
  },
  createButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },

  // Create form
  createForm: { flex: 1 },
  createFormContent: { padding: Spacing.lg },
  fieldLabel: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    fontWeight: '500', marginBottom: Spacing.sm,
  },
  compoundRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, marginBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compoundLabel: { color: Colors.text, fontSize: FontSize.md },
  backButton: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  backButtonText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
