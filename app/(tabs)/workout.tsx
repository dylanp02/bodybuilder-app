// app/(tabs)/workout.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, Modal, FlatList, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { Exercise, MuscleGroup } from '../../lib/types';

interface SetEntry {
  reps: string;
  weight: string;
  isWarmup: boolean;
}

interface HistoricSet {
  reps: number | null;
  weight: number | null;
}

interface ExerciseCard {
  id: string;
  exercise: Exercise;
  sets: SetEntry[];
  historicSets: HistoricSet[];
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

const ALL_PLATE_SIZES = [45, 35, 25, 10, 5, 2.5, 1];

const BAR_PRESETS = [
  { label: '45 Standard', value: 45 },
  { label: "35 Women's", value: 35 },
  { label: '105 Leg Press', value: 105 },
];

const TEMPLATES = [
  {
    name: 'Push Day',
    exercises: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown', 'Lateral Raise'],
  },
  {
    name: 'Pull Day',
    exercises: ['Deadlift', 'Pull-Up', 'Barbell Row', 'Bicep Curl', 'Face Pull'],
  },
  {
    name: 'Leg Day',
    exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'],
  },
];

const formatElapsed = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatHistoric = (h: HistoricSet | undefined) => {
  if (!h) return '—';
  if (h.reps == null && h.weight == null) return '—';
  const r = h.reps != null ? `${h.reps}` : '?';
  const w = h.weight != null ? `${h.weight}` : '?';
  return `${r}×${w}`;
};

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Workout state
  const [workoutActive, setWorkoutActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [workoutName, setWorkoutName] = useState('');
  const [cards, setCards] = useState<ExerciseCard[]>([]);
  const [saving, setSaving] = useState(false);

  // Picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | MuscleGroup>('all');
  const [activeEquipment, setActiveEquipment] = useState('all');

  // Create exercise form (inside picker)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState<MuscleGroup>('chest');
  const [newEquipment, setNewEquipment] = useState('');
  const [newIsCompound, setNewIsCompound] = useState(false);
  const [creating, setCreating] = useState(false);

  // Warmup modal
  const [warmupCardId, setWarmupCardId] = useState<string | null>(null);
  const [warmupNumSets, setWarmupNumSets] = useState('2');
  const [warmupWeight, setWarmupWeight] = useState('');
  const [warmupReps, setWarmupReps] = useState('');

  // Plate calculator
  const [calcOpen, setCalcOpen] = useState(false);
  const [barWeight, setBarWeight] = useState(45);
  const [customBarText, setCustomBarText] = useState('');
  const [disabledPlates, setDisabledPlates] = useState<number[]>([]);
  const [targetWeight, setTargetWeight] = useState('');

  useEffect(() => { loadExercises(); }, []);

  // Stopwatch
  useEffect(() => {
    if (!workoutActive) return;
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [workoutActive]);

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').order('name');
    if (data) setExercises(data);
  };

  const filteredExercises = useMemo(() => {
    const byGroup = activeTab === 'all'
      ? exercises
      : exercises.filter(e => e.muscle_group.toLowerCase() === activeTab.toLowerCase());
    return activeEquipment === 'all'
      ? byGroup
      : byGroup.filter(e => (e.equipment ?? '').toLowerCase() === activeEquipment.toLowerCase());
  }, [exercises, activeTab, activeEquipment]);

  // Plate calculator greedy result
  const plateResult = useMemo(() => {
    const target = parseFloat(targetWeight);
    if (!target || target <= barWeight) return null;
    const available = ALL_PLATE_SIZES.filter(p => !disabledPlates.includes(p));
    let remaining = Math.round(((target - barWeight) / 2) * 100) / 100;
    const result: { plate: number; count: number }[] = [];
    for (const plate of available) {
      if (remaining < 0.01) break;
      const count = Math.floor(remaining / plate + 0.001);
      if (count > 0) {
        result.push({ plate, count });
        remaining = Math.round((remaining - plate * count) * 100) / 100;
      }
    }
    if (remaining > 0.5) return null;
    return result;
  }, [targetWeight, barWeight, disabledPlates]);

  // ── Historic sets ──

  const loadHistoricSets = async (exerciseId: string, cardId: string) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('set_number, reps, weight_lbs, workout_id, workouts(date, created_at)')
      .eq('exercise_id', exerciseId)
      .limit(60);

    if (!data || data.length === 0) return;

    type Row = {
      set_number: number;
      reps: number | null;
      weight_lbs: number | null;
      workout_id: string;
      workouts: { date: string; created_at: string } | null;
    };
    const rows = data as unknown as Row[];

    // Find the most recent workout containing this exercise
    const sorted = [...rows].sort((a, b) => {
      const da = a.workouts?.date ?? '';
      const db = b.workouts?.date ?? '';
      if (db !== da) return db.localeCompare(da);
      return (b.workouts?.created_at ?? '').localeCompare(a.workouts?.created_at ?? '');
    });

    const mostRecentId = sorted[0].workout_id;
    const historicSets: HistoricSet[] = rows
      .filter(r => r.workout_id === mostRecentId)
      .sort((a, b) => a.set_number - b.set_number)
      .map(r => ({ reps: r.reps, weight: r.weight_lbs }));

    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, historicSets } : c
    ));
  };

  // ── Workout start ──

  const startBlankWorkout = () => {
    setWorkoutName('');
    setCards([]);
    setElapsed(0);
    setWorkoutActive(true);
  };

  const startFromTemplate = (template: typeof TEMPLATES[0]) => {
    const templateCards: ExerciseCard[] = [];
    for (const name of template.exercises) {
      const ex = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (ex) {
        templateCards.push({
          id: `${ex.id}-${Date.now()}-${Math.random()}`,
          exercise: ex,
          sets: [{ reps: '', weight: '', isWarmup: false }],
          historicSets: [],
        });
      }
    }
    setWorkoutName(template.name);
    setCards(templateCards);
    setElapsed(0);
    setWorkoutActive(true);
    for (const card of templateCards) {
      loadHistoricSets(card.exercise.id, card.id);
    }
  };

  const cancelWorkout = () => {
    Alert.alert(
      'Cancel Workout?',
      'Your sets will not be saved.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setWorkoutActive(false);
            setElapsed(0);
            setCards([]);
            setWorkoutName('');
          },
        },
      ]
    );
  };

  // ── Card operations ──

  const addCard = (exercise: Exercise) => {
    const cardId = `${exercise.id}-${Date.now()}`;
    setCards(prev => [...prev, {
      id: cardId,
      exercise,
      sets: [{ reps: '', weight: '', isWarmup: false }],
      historicSets: [],
    }]);
    setShowPicker(false);
    setShowCreateForm(false);
    loadHistoricSets(exercise.id, cardId);
  };

  const removeCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const addSet = (cardId: string) => {
    setCards(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, sets: [...c.sets, { reps: '', weight: '', isWarmup: false }] }
        : c
    ));
  };

  const removeSet = (cardId: string, index: number) => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId || c.sets.length === 1) return c;
      return { ...c, sets: c.sets.filter((_, i) => i !== index) };
    }));
  };

  const updateSet = (cardId: string, index: number, field: 'reps' | 'weight', value: string) => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const sets = [...c.sets];
      sets[index] = { ...sets[index], [field]: value };
      return { ...c, sets };
    }));
  };

  // ── Warmup sets ──

  const addWarmupSets = () => {
    const numSets = Math.max(1, parseInt(warmupNumSets) || 1);
    const newWarmups: SetEntry[] = Array.from({ length: numSets }, () => ({
      reps: warmupReps,
      weight: warmupWeight,
      isWarmup: true,
    }));
    setCards(prev => prev.map(c => {
      if (c.id !== warmupCardId) return c;
      const existingWarmups = c.sets.filter(s => s.isWarmup);
      const workingSets = c.sets.filter(s => !s.isWarmup);
      return { ...c, sets: [...existingWarmups, ...newWarmups, ...workingSets] };
    }));
    setWarmupCardId(null);
    setWarmupNumSets('2');
    setWarmupWeight('');
    setWarmupReps('');
  };

  // ── Picker helpers ──

  const openPicker = () => {
    setShowCreateForm(false);
    setShowPicker(true);
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
      addCard(data);
    }
    setCreating(false);
  };

  // ── Finish workout — warmup sets are ephemeral and not saved to DB ──

  const finishWorkout = async () => {
    if (!workoutName.trim()) { Alert.alert('Name your workout'); return; }

    type SaveEntry = { card: ExerciseCard; setNum: number; reps: string; weight: string };
    const toSave: SaveEntry[] = [];
    for (const card of cards) {
      let workingNum = 0;
      for (const set of card.sets) {
        if (set.isWarmup) continue;
        workingNum++;
        if (set.reps.trim() || set.weight.trim()) {
          toSave.push({ card, setNum: workingNum, reps: set.reps, weight: set.weight });
        }
      }
    }
    if (toSave.length === 0) { Alert.alert('Log at least one working set'); return; }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const today = new Date().toISOString().split('T')[0];
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: workoutName.trim(), date: today })
      .select()
      .single();

    if (workoutError || !workout) {
      Alert.alert('Error saving workout', workoutError?.message);
      setSaving(false);
      return;
    }

    const { error: setsError } = await supabase.from('workout_sets').insert(
      toSave.map(s => ({
        workout_id: workout.id,
        exercise_id: s.card.exercise.id,
        set_number: s.setNum,
        reps: parseInt(s.reps) || null,
        weight_lbs: parseFloat(s.weight) || null,
      }))
    );

    if (setsError) {
      Alert.alert('Error saving sets', setsError.message);
      setSaving(false);
    } else {
      setWorkoutName('');
      setCards([]);
      setElapsed(0);
      setWorkoutActive(false);
      setSaving(false);
      router.push(`/workout/${workout.id}`);
    }
  };

  // ── Plate calculator ──

  const togglePlate = (plate: number) => {
    setDisabledPlates(prev =>
      prev.includes(plate) ? prev.filter(p => p !== plate) : [...prev, plate]
    );
  };

  // ── Render ──

  return (
    <>
      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {!workoutActive ? (
            // ── STATE 1: No active workout ──
            <>
              <Text style={styles.screenTitle}>Workout</Text>

              <Pressable style={styles.startBlankButton} onPress={startBlankWorkout}>
                <Text style={styles.startBlankText}>Start Blank Workout</Text>
              </Pressable>

              <Text style={styles.sectionHeader}>Templates</Text>

              {TEMPLATES.map(template => (
                <Pressable
                  key={template.name}
                  style={styles.templateCard}
                  onPress={() => startFromTemplate(template)}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateExercises} numberOfLines={2}>
                    {template.exercises.join(' · ')}
                  </Text>
                </Pressable>
              ))}

              <View style={styles.proCard}>
                <Text style={styles.proLabel}>PRO</Text>
                <Text style={styles.proTitle}>Create Custom Template</Text>
                <Text style={styles.proSub}>Save your own workout templates — coming soon</Text>
              </View>
            </>
          ) : (
            // ── STATE 2: Workout active ──
            <>
              <View style={styles.activeHeader}>
                <Text style={styles.stopwatch}>{formatElapsed(elapsed)}</Text>
                <View style={styles.activeHeaderButtons}>
                  <Pressable style={styles.cancelButton} onPress={cancelWorkout}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.finishButton, saving && styles.finishButtonDisabled]}
                    onPress={finishWorkout}
                    disabled={saving}
                  >
                    <Text style={styles.finishButtonText}>
                      {saving ? 'Saving...' : 'Finish'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder='Workout name (e.g. "Push Day A")'
                placeholderTextColor={Colors.textDisabled}
                value={workoutName}
                onChangeText={setWorkoutName}
              />

              {cards.map(card => {
                let warmupCount = 0;
                let workingCount = 0;
                return (
                  <View key={card.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.cardExerciseName}>{card.exercise.name}</Text>
                        <Text style={styles.cardMuscleGroup}>{card.exercise.muscle_group}</Text>
                      </View>
                      <Pressable
                        style={styles.warmupBtn}
                        onPress={() => setWarmupCardId(card.id)}
                      >
                        <Text style={styles.warmupBtnText}>W</Text>
                      </Pressable>
                      <Pressable onPress={() => removeCard(card.id)} style={styles.cardDeleteHit}>
                        <Text style={styles.cardDeleteText}>✕</Text>
                      </Pressable>
                    </View>

                    <View style={styles.setColHeader}>
                      <Text style={[styles.setColLabel, styles.colNum]}>#</Text>
                      <Text style={[styles.setColLabel, styles.colLast]}>Last</Text>
                      <Text style={[styles.setColLabel, styles.colInput]}>Reps</Text>
                      <Text style={[styles.setColLabel, styles.colInput]}>Wt (lbs)</Text>
                      <View style={styles.colRemove} />
                    </View>

                    {card.sets.map((set, idx) => {
                      let label: string;
                      let historicIdx: number;
                      if (set.isWarmup) {
                        warmupCount++;
                        label = `W${warmupCount}`;
                        historicIdx = -1;
                      } else {
                        historicIdx = workingCount;
                        workingCount++;
                        label = `${workingCount}`;
                      }
                      const historic = historicIdx >= 0 ? card.historicSets[historicIdx] : undefined;

                      return (
                        <View key={idx} style={styles.setRow}>
                          <Text style={[styles.setNum, styles.colNum, set.isWarmup && styles.setNumWarmup]}>
                            {label}
                          </Text>
                          <Text style={[styles.historicText, styles.colLast]}>
                            {set.isWarmup ? '—' : formatHistoric(historic)}
                          </Text>
                          <TextInput
                            style={[styles.setInput, styles.colInput]}
                            placeholder="—"
                            placeholderTextColor={Colors.textDisabled}
                            value={set.reps}
                            onChangeText={v => updateSet(card.id, idx, 'reps', v)}
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={[styles.setInput, styles.colInput]}
                            placeholder="—"
                            placeholderTextColor={Colors.textDisabled}
                            value={set.weight}
                            onChangeText={v => updateSet(card.id, idx, 'weight', v)}
                            keyboardType="decimal-pad"
                          />
                          <Pressable style={styles.colRemove} onPress={() => removeSet(card.id, idx)}>
                            <Text style={styles.setRemoveText}>✕</Text>
                          </Pressable>
                        </View>
                      );
                    })}

                    <Pressable style={styles.addSetButton} onPress={() => addSet(card.id)}>
                      <Text style={styles.addSetButtonText}>+ Add Set</Text>
                    </Pressable>
                  </View>
                );
              })}

              <Pressable style={styles.addExerciseButton} onPress={openPicker}>
                <Text style={styles.addExerciseText}>+ Add Exercise</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* ── Plate Calculator — always visible ── */}
        <View style={styles.plateCalc}>
          <Pressable style={styles.plateCalcHandle} onPress={() => setCalcOpen(v => !v)}>
            <Text style={styles.plateCalcHandleText}>
              Plate Calculator {calcOpen ? '▲' : '▼'}
            </Text>
          </Pressable>

          {calcOpen && (
            <View style={styles.plateCalcBody}>
              <Text style={styles.calcLabel}>Bar Weight</Text>
              <View style={styles.chipRow}>
                {BAR_PRESETS.map(p => (
                  <Pressable
                    key={p.value}
                    style={[styles.chip, barWeight === p.value && !customBarText && styles.chipActive]}
                    onPress={() => { setBarWeight(p.value); setCustomBarText(''); }}
                  >
                    <Text style={[styles.chipText, barWeight === p.value && !customBarText && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  style={[styles.calcInput, customBarText ? styles.calcInputActive : null]}
                  placeholder="Custom"
                  placeholderTextColor={Colors.textDisabled}
                  value={customBarText}
                  onChangeText={t => {
                    setCustomBarText(t);
                    const n = parseFloat(t);
                    if (!isNaN(n) && n > 0) setBarWeight(n);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.calcLabel}>Available Plates</Text>
              <View style={styles.chipRow}>
                {ALL_PLATE_SIZES.map(p => (
                  <Pressable
                    key={p}
                    style={[styles.chip, !disabledPlates.includes(p) && styles.chipActive]}
                    onPress={() => togglePlate(p)}
                  >
                    <Text style={[styles.chipText, !disabledPlates.includes(p) && styles.chipTextActive]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.calcLabel}>Target Weight (lbs)</Text>
              <TextInput
                style={styles.calcInputFull}
                placeholder="e.g. 225"
                placeholderTextColor={Colors.textDisabled}
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="decimal-pad"
              />

              {targetWeight !== '' && (
                <View style={styles.calcResult}>
                  {plateResult && plateResult.length > 0 ? (
                    <Text style={styles.calcResultText}>
                      Each side: {plateResult.map(r => `${r.count} × ${r.plate}`).join(', ')}
                    </Text>
                  ) : plateResult && plateResult.length === 0 ? (
                    <Text style={styles.calcResultText}>Bar only</Text>
                  ) : (
                    <Text style={styles.calcResultError}>
                      {parseFloat(targetWeight) <= barWeight
                        ? 'Target must exceed bar weight'
                        : "Can't reach this weight with available plates"}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ── Warmup Modal ── */}
      <Modal
        visible={warmupCardId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWarmupCardId(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Warmup Sets</Text>
            <Pressable onPress={() => setWarmupCardId(null)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.createForm}
            contentContainerStyle={styles.createFormContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Number of Sets</Text>
            <TextInput
              style={styles.input}
              value={warmupNumSets}
              onChangeText={setWarmupNumSets}
              keyboardType="numeric"
              placeholder="2"
              placeholderTextColor={Colors.textDisabled}
            />
            <Text style={styles.fieldLabel}>Reps per Set</Text>
            <TextInput
              style={styles.input}
              value={warmupReps}
              onChangeText={setWarmupReps}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={Colors.textDisabled}
            />
            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={warmupWeight}
              onChangeText={setWarmupWeight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={Colors.textDisabled}
            />
            <Pressable style={styles.saveButton} onPress={addWarmupSets}>
              <Text style={styles.saveButtonText}>Add Warmup Sets</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

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
              {showCreateForm ? 'New Exercise' : 'Add Exercise'}
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
                  {creating ? 'Creating...' : 'Create & Add'}
                </Text>
              </Pressable>

              <Pressable style={styles.backButton} onPress={() => setShowCreateForm(false)}>
                <Text style={styles.backButtonText}>← Back to list</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <View style={styles.filterRowWrap}>
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
              </View>

              <View style={styles.filterRowWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabRowContent}
                  style={styles.tabRow}
                >
                  {['all', 'Barbell', 'Bodyweight', 'Cable', 'Dumbbell', 'Machine'].map(eq => (
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
                  <Pressable style={styles.pickerItem} onPress={() => addCard(item)}>
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
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
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

  // ── State 1 ──
  startBlankButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  startBlankText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  sectionHeader: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  templateCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  templateName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  templateExercises: { fontSize: FontSize.sm, color: Colors.textSecondary },
  proCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary, opacity: 0.6,
  },
  proLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700',
    letterSpacing: 1, marginBottom: 4,
  },
  proTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  proSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  // ── State 2 header ──
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stopwatch: { fontSize: 32, fontWeight: '700', color: Colors.text },
  activeHeaderButtons: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  finishButton: {
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  finishButtonDisabled: { opacity: 0.6 },
  finishButtonText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // ── Exercise cards ──
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.sm,
  },
  cardHeaderLeft: { flex: 1 },
  cardExerciseName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardMuscleGroup: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2,
  },
  warmupBtn: {
    width: 28, height: 28,
    backgroundColor: Colors.warning,
    borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: Spacing.sm, marginTop: 2,
  },
  warmupBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  cardDeleteHit: { paddingLeft: Spacing.sm, paddingBottom: Spacing.sm },
  cardDeleteText: { color: Colors.danger, fontSize: FontSize.md },

  // Column layout
  setColHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: Spacing.xs, marginBottom: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  setColLabel: { color: Colors.textDisabled, fontSize: FontSize.xs, fontWeight: '500' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  colNum: { width: 30 },
  colLast: { width: 52, marginRight: Spacing.xs },
  colInput: { flex: 1, marginHorizontal: Spacing.xs },
  colRemove: { width: 28, alignItems: 'flex-end' },
  setNum: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  setNumWarmup: { color: Colors.warning },
  historicText: { color: Colors.textDisabled, fontSize: FontSize.xs },
  setInput: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6,
    color: Colors.text, fontSize: FontSize.md, textAlign: 'center',
  },
  setRemoveText: { color: Colors.danger, fontSize: FontSize.sm },
  addSetButton: {
    marginTop: Spacing.sm, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, alignItems: 'center',
  },
  addSetButtonText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  addExerciseButton: {
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: Radius.md, padding: Spacing.md,
    alignItems: 'center', marginBottom: Spacing.md,
  },
  addExerciseText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  saveButton: {
    backgroundColor: Colors.primary, padding: Spacing.lg,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // ── Plate calculator ──
  plateCalc: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  plateCalcHandle: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, alignItems: 'center',
  },
  plateCalcHandleText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  plateCalcBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  calcLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.xs, marginTop: Spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  calcInput: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6,
    color: Colors.text, fontSize: FontSize.sm, width: 70, textAlign: 'center',
  },
  calcInputActive: { borderColor: Colors.primary },
  calcInputFull: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8,
    color: Colors.text, fontSize: FontSize.md, marginTop: Spacing.xs,
  },
  calcResult: {
    marginTop: Spacing.sm, padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  calcResultText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  calcResultError: { color: Colors.textSecondary, fontSize: FontSize.sm },

  // ── Picker modal ──
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

  // ── Create form ──
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
