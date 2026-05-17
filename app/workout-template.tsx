// app/workout-template.tsx — create and manage custom workout templates (Pro feature, unlocked for dev)
// Persists to the `workout_templates` table in Supabase.
//
// Schema (already applied):
//   CREATE TABLE workout_templates (
//     id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//     name       TEXT NOT NULL,
//     exercises  JSONB NOT NULL DEFAULT '[]',
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "users manage own templates" ON workout_templates
//     FOR ALL TO authenticated
//     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, Modal, FlatList, Switch, ActivityIndicator,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { useProContext } from '../lib/ProContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import { Exercise, MuscleGroup } from '../lib/types';
import { MUSCLE_GROUPS, EQUIPMENT_FILTERS } from '../lib/constants';

interface SetEntry {
  reps: string;
  weight: string;
  isWarmup: boolean;
}

interface ExerciseCard {
  id: string;
  exercise: Exercise;
  sets: SetEntry[];
}

interface TemplateExerciseData {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  equipment: string | null;
  isCompound: boolean;
  sets: SetEntry[];
}

interface SavedTemplate {
  id: string;
  name: string;
  exercises: TemplateExerciseData[];
  created_at: string;
}

export default function WorkoutTemplateScreen() {
  const { isPro } = useProContext();
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [cards, setCards] = useState<ExerciseCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | MuscleGroup>('all');
  const [activeEquipment, setActiveEquipment] = useState('all');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState<MuscleGroup>('chest');
  const [newEquipment, setNewEquipment] = useState('');
  const [newIsCompound, setNewIsCompound] = useState(false);
  const [creating, setCreating] = useState(false);

  const [warmupCardId, setWarmupCardId] = useState<string | null>(null);
  const [warmupNumSets, setWarmupNumSets] = useState('2');
  const [warmupWeight, setWarmupWeight] = useState('');
  const [warmupReps, setWarmupReps] = useState('');

  useEffect(() => { loadTemplates(); }, [isPro]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const user = await getCurrentUser();
    if (!user) { setLoadingTemplates(false); return; }
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, exercises, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setSavedTemplates(data as SavedTemplate[]);
    setLoadingTemplates(false);
  };

  const filteredExercises = useMemo(() => {
    const byGroup = activeTab === 'all'
      ? exercises
      : exercises.filter(e => e.muscle_group.toLowerCase() === activeTab.toLowerCase());
    return activeEquipment === 'all'
      ? byGroup
      : byGroup.filter(e => (e.equipment ?? '').toLowerCase() === activeEquipment.toLowerCase());
  }, [exercises, activeTab, activeEquipment]);

  const loadExerciseList = async () => {
    if (exercisesLoaded) return;
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment, is_compound, notes')
      .order('name');
    if (data) setExercises(data as Exercise[]);
    setExercisesLoaded(true);
  };

  const openPicker = () => {
    setShowCreateForm(false);
    loadExerciseList();
    setShowPicker(true);
  };

  const addCard = (exercise: Exercise) => {
    const cardId = `${exercise.id}-${Date.now()}`;
    setCards(prev => [...prev, {
      id: cardId,
      exercise,
      sets: [{ reps: '', weight: '', isWarmup: false }],
    }]);
    setShowPicker(false);
    setShowCreateForm(false);
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

  const addWarmupSets = () => {
    const numSets = Math.max(1, parseInt(warmupNumSets) || 1);
    const newWarmups: SetEntry[] = Array.from({ length: numSets }, () => ({
      reps: warmupReps, weight: warmupWeight, isWarmup: true,
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

  const handleSave = async () => {
    if (!templateName.trim()) { Alert.alert('Enter a template name'); return; }
    if (cards.length === 0) { Alert.alert('Add at least one exercise'); return; }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const exercisesPayload: TemplateExerciseData[] = cards.map(c => ({
      exerciseId: c.exercise.id,
      exerciseName: c.exercise.name,
      muscleGroup: c.exercise.muscle_group,
      equipment: c.exercise.equipment ?? null,
      isCompound: c.exercise.is_compound ?? false,
      sets: c.sets,
    }));

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from('workout_templates')
        .update({ name: templateName.trim(), exercises: exercisesPayload })
        .eq('id', editingId)
        .eq('user_id', user.id));
    } else {
      ({ error } = await supabase
        .from('workout_templates')
        .insert({ user_id: user.id, name: templateName.trim(), exercises: exercisesPayload }));
    }

    if (error) {
      Alert.alert('Error saving template', error.message);
    } else {
      clearEditor();
      await loadTemplates();
    }
    setSaving(false);
  };

  const loadTemplate = (template: SavedTemplate) => {
    const restoredCards: ExerciseCard[] = template.exercises.map(e => ({
      id: `${e.exerciseId}-${Date.now()}-${Math.random()}`,
      exercise: {
        id: e.exerciseId,
        name: e.exerciseName,
        muscle_group: e.muscleGroup as MuscleGroup,
        equipment: e.equipment ?? undefined,
        is_compound: e.isCompound,
      } as Exercise,
      sets: e.sets,
    }));
    setTemplateName(template.name);
    setCards(restoredCards);
    setEditingId(template.id);
  };

  const deleteTemplate = (template: SavedTemplate) => {
    Alert.alert(
      'Delete Template',
      `Delete "${template.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const user = await getCurrentUser();
            if (!user) return;
            const { error } = await supabase
              .from('workout_templates')
              .delete()
              .eq('id', template.id)
              .eq('user_id', user.id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              if (editingId === template.id) clearEditor();
              await loadTemplates();
            }
          },
        },
      ]
    );
  };

  const clearEditor = () => {
    setTemplateName('');
    setCards([]);
    setEditingId(null);
  };

  if (!isPro) return <Redirect href="/subscription" />;

  return (
    <>
      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <View style={styles.titleRow}>
            <Text style={styles.title}>Workout Templates</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>

          {/* Saved templates list */}
          {loadingTemplates ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : savedTemplates.length > 0 ? (
            <View style={styles.savedSection}>
              <Text style={styles.sectionHeader}>MY TEMPLATES</Text>
              {savedTemplates.map(t => (
                <View key={t.id} style={[styles.savedCard, editingId === t.id && styles.savedCardActive]}>
                  <View style={styles.savedCardLeft}>
                    <Text style={styles.savedCardName}>{t.name}</Text>
                    <Text style={styles.savedCardSub}>
                      {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.savedCardActions}>
                    <Pressable
                      style={styles.loadBtn}
                      onPress={() => loadTemplate(t)}
                    >
                      <Text style={styles.loadBtnText}>
                        {editingId === t.id ? 'Editing' : 'Edit'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => deleteTemplate(t)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Builder */}
          <Text style={styles.sectionHeader}>
            {editingId ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}
          </Text>

          <TextInput
            style={styles.nameInput}
            placeholder='Template name (e.g. "Push Day A")'
            placeholderTextColor={Colors.textDisabled}
            value={templateName}
            onChangeText={setTemplateName}
            autoCapitalize="words"
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
                  <Text style={[styles.setColLabel, styles.colInput]}>Reps</Text>
                  <Text style={[styles.setColLabel, styles.colInput]}>Wt (lbs)</Text>
                  <View style={styles.colRemove} />
                </View>

                {card.sets.map((set, idx) => {
                  let label: string;
                  if (set.isWarmup) {
                    warmupCount++;
                    label = `W${warmupCount}`;
                  } else {
                    workingCount++;
                    label = `${workingCount}`;
                  }
                  return (
                    <View key={idx} style={styles.setRow}>
                      <Text style={[styles.setNum, styles.colNum, set.isWarmup && styles.setNumWarmup]}>
                        {label}
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

          {cards.length > 0 && (
            <>
              <Pressable
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
                </Text>
              </Pressable>
              {editingId && (
                <Pressable style={styles.cancelEditBtn} onPress={clearEditor}>
                  <Text style={styles.cancelEditText}>Cancel edit</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Warmup Modal */}
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
            <Pressable style={styles.primaryButton} onPress={addWarmupSets}>
              <Text style={styles.primaryButtonText}>Add Warmup Sets</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
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
                style={[styles.input, styles.inputSpacedTop]}
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
                style={[styles.primaryButton, creating && styles.primaryButtonDisabled]}
                onPress={createExercise}
                disabled={creating}
              >
                <Text style={styles.primaryButtonText}>
                  {creating ? 'Creating...' : 'Create & Add'}
                </Text>
              </Pressable>

              <Pressable style={styles.backToList} onPress={() => setShowCreateForm(false)}>
                <Text style={styles.backToListText}>← Back to list</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
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
                      onPress={() => { setActiveTab(g.key as typeof activeTab); setActiveEquipment('all'); }}
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

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },

  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
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

  loader: { marginVertical: Spacing.lg },

  savedSection: { marginBottom: Spacing.xl },
  sectionHeader: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  savedCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  savedCardActive: { borderColor: Colors.primary },
  savedCardLeft: { flex: 1 },
  savedCardName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  savedCardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  savedCardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loadBtn: {
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  loadBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.danger, fontSize: FontSize.md, fontWeight: '700' },

  nameInput: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },

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
    width: 28, height: 28, backgroundColor: Colors.warning,
    borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center',
    marginLeft: Spacing.sm, marginTop: 2,
  },
  warmupBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  cardDeleteHit: { paddingLeft: Spacing.sm, paddingBottom: Spacing.sm },
  cardDeleteText: { color: Colors.danger, fontSize: FontSize.md },

  setColHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: Spacing.xs, marginBottom: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  setColLabel: { color: Colors.textDisabled, fontSize: FontSize.xs, fontWeight: '500' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  colNum: { width: 30 },
  colInput: { flex: 1, marginHorizontal: Spacing.xs },
  colRemove: { width: 28, alignItems: 'flex-end' },
  setNum: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  setNumWarmup: { color: Colors.warning },
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

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
  cancelEditBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  cancelEditText: { color: Colors.textSecondary, fontSize: FontSize.sm },

  // Modal shared
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
    height: 36, paddingHorizontal: 14, borderRadius: 0,
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
  createButtonWrap: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  createButton: {
    backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary,
  },
  createButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },

  createForm: { flex: 1 },
  createFormContent: { padding: Spacing.lg },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  inputSpacedTop: { marginTop: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm },
  compoundRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, marginBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compoundLabel: { color: Colors.text, fontSize: FontSize.md },
  primaryButton: {
    backgroundColor: Colors.primary, padding: Spacing.lg,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  backToList: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  backToListText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
