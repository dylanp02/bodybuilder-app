// app/(tabs)/workout.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, FlatList
} from 'react-native';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { Exercise, WorkoutSet } from '../../lib/types';

// Represents a set being built before saving to the database
interface PendingSet {
  exercise: Exercise;
  setNumber: number;
  reps: string;
  weight: string;
}

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [pendingSets, setPendingSets] = useState<PendingSet[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name');
    if (data) setExercises(data);
  };

  const addSet = () => {
    if (!selectedExercise) {
      Alert.alert('Select an exercise first');
      return;
    }
    if (!reps) {
      Alert.alert('Enter reps');
      return;
    }

    // Count existing sets for this exercise to determine set number
    const existingSets = pendingSets.filter(
      s => s.exercise.id === selectedExercise.id
    );

    setPendingSets(prev => [...prev, {
      exercise: selectedExercise,
      setNumber: existingSets.length + 1,
      reps,
      weight,
    }]);

    // Clear inputs for next set but keep the same exercise selected
    setReps('');
    setWeight('');
  };

  const removeSet = (index: number) => {
    setPendingSets(prev => prev.filter((_, i) => i !== index));
  };

  const saveWorkout = async () => {
    if (!workoutName) { Alert.alert('Name your workout'); return; }
    if (pendingSets.length === 0) { Alert.alert('Log at least one set'); return; }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    // Step 1: Create the workout record
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

    // Step 2: Save all the sets linked to that workout
    const setsToInsert = pendingSets.map(s => ({
      workout_id: workout.id,
      exercise_id: s.exercise.id,
      set_number: s.setNumber,
      reps: parseInt(s.reps) || null,
      weight_lbs: parseFloat(s.weight) || null,
    }));

    const { error: setsError } = await supabase
      .from('workout_sets')
      .insert(setsToInsert);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Log Workout</Text>

      {/* Workout name */}
      <TextInput
        style={styles.input}
        placeholder='Workout name (e.g. "Push Day A")'
        placeholderTextColor={Colors.textDisabled}
        value={workoutName}
        onChangeText={setWorkoutName}
      />

      {/* Exercise picker */}
      <Pressable
        style={styles.pickerButton}
        onPress={() => setShowExercisePicker(!showExercisePicker)}
      >
        <Text style={styles.pickerButtonText}>
          {selectedExercise ? selectedExercise.name : 'Select Exercise'}
        </Text>
      </Pressable>

      {showExercisePicker && (
        <View style={styles.pickerList}>
          {exercises.map(ex => (
            <Pressable
              key={ex.id}
              style={styles.pickerItem}
              onPress={() => {
                setSelectedExercise(ex);
                setShowExercisePicker(false);
              }}
            >
              <Text style={styles.pickerItemText}>{ex.name}</Text>
              <Text style={styles.pickerItemSub}>{ex.muscle_group}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Set inputs */}
      {selectedExercise && (
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
            <Text style={styles.addSetButtonText}>+ Add</Text>
          </Pressable>
        </View>
      )}

      {/* Logged sets */}
      {pendingSets.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sets logged</Text>
          {pendingSets.map((set, index) => (
            <View key={index} style={styles.setRow}>
              <View style={styles.setRowLeft}>
                <Text style={styles.setExercise}>{set.exercise.name}</Text>
                <Text style={styles.setDetail}>
                  Set {set.setNumber} · {set.reps} reps
                  {set.weight ? ` · ${set.weight} lbs` : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeSet(index)}>
                <Text style={styles.removeSet}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Save button */}
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
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  pickerButton: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  pickerButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  pickerList: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    maxHeight: 220, marginBottom: Spacing.md, overflow: 'hidden',
  },
  pickerItem: {
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemText: { color: Colors.text, fontSize: FontSize.md },
  pickerItemSub: { color: Colors.textSecondary, fontSize: FontSize.sm },
  setInputRow: {
    flexDirection: 'row', gap: Spacing.sm,
    alignItems: 'center', marginBottom: Spacing.md,
  },
  setInput: { flex: 1, marginBottom: 0 },
  addSetButton: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, borderRadius: Radius.md,
  },
  addSetButtonText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  setRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  setRowLeft: { flex: 1 },
  setExercise: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  setDetail: { color: Colors.textSecondary, fontSize: FontSize.sm },
  removeSet: { color: Colors.danger, fontSize: FontSize.md, paddingLeft: Spacing.md },
  saveButton: {
    backgroundColor: Colors.primary, padding: Spacing.lg,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});