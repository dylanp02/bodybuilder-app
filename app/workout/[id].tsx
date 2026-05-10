// app/workout/[id].tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';

interface SetRow {
  id: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  exercises: { name: string; muscle_group: string };
}

interface ExerciseGroup {
  exerciseName: string;
  muscleGroup: string;
  sets: SetRow[];
}

export default function WorkoutDetailScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState('');
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadWorkout();
  }, [id]);

  const loadWorkout = async () => {
    const [workoutRes, setsRes] = await Promise.all([
      supabase.from('workouts').select('name, date').eq('id', id).single(),
      supabase
        .from('workout_sets')
        .select('id, set_number, reps, weight_lbs, exercises(name, muscle_group)')
        .eq('workout_id', id)
        .order('set_number'),
    ]);

    if (workoutRes.data) {
      setWorkoutName(workoutRes.data.name);
      setWorkoutDate(workoutRes.data.date);
    }

    if (setsRes.data) {
      const groupMap = new Map<string, ExerciseGroup>();
      for (const row of setsRes.data as unknown as SetRow[]) {
        const key = row.exercises.name;
        if (!groupMap.has(key)) {
          groupMap.set(key, { exerciseName: key, muscleGroup: row.exercises.muscle_group, sets: [] });
        }
        groupMap.get(key)!.sets.push(row);
      }
      setGroups(Array.from(groupMap.values()));
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>{workoutName}</Text>
      <Text style={styles.date}>
        {new Date(workoutDate).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        })}
      </Text>

      {groups.map(group => (
        <View key={group.exerciseName} style={styles.card}>
          <Text style={styles.exerciseName}>{group.exerciseName}</Text>
          <Text style={styles.muscleGroup}>{group.muscleGroup}</Text>

          <View style={styles.setHeader}>
            <Text style={[styles.setHeaderText, styles.colNum]}>#</Text>
            <Text style={[styles.setHeaderText, styles.colVal]}>Reps</Text>
            <Text style={[styles.setHeaderText, styles.colVal]}>Weight (lbs)</Text>
          </View>

          {group.sets.map(set => (
            <View key={set.id} style={styles.setRow}>
              <Text style={[styles.setNum, styles.colNum]}>{set.set_number}</Text>
              <Text style={[styles.setValue, styles.colVal]}>{set.reps ?? '—'}</Text>
              <Text style={[styles.setValue, styles.colVal]}>
                {set.weight_lbs != null ? `${set.weight_lbs}` : '—'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  exerciseName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  muscleGroup: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: Spacing.sm,
  },
  setHeader: {
    flexDirection: 'row', paddingBottom: Spacing.xs, marginBottom: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  setHeaderText: { color: Colors.textDisabled, fontSize: FontSize.xs, fontWeight: '500' },
  setRow: { flexDirection: 'row', paddingVertical: 4 },
  setNum: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  setValue: { color: Colors.text, fontSize: FontSize.sm },
  colNum: { width: 28 },
  colVal: { flex: 1 },
});
