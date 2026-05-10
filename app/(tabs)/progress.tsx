// app/(tabs)/progress.tsx — workout consistency calendar and per-exercise progress charts
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';
import { Exercise, MuscleGroup, TrainingPlan, DayCard } from '../../lib/types';
import { MUSCLE_GROUPS } from '../../lib/constants';
import LineChart, { ChartPoint } from '../../components/LineChart';
import { isoDate, formatShortDate, formatFullDate, errorMessage } from '../../lib/utils';
import { generateProjectedDates } from '../../lib/planProjection';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkoutStub { id: string; name: string; date: string }

interface TrackedExercise {
  exercise: Exercise;
  chartPoints: ChartPoint[] | null;   // null = loading, [] = loaded empty
  historyRows: { workoutName: string; date: string }[] | null;
  chartError: string | null;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Builds a 7-column grid of day numbers (null = padding cell) for a given month. */
function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  // month is 0-indexed; getDay() gives Sunday=0 offset for first cell
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // ── Calendar state ──
  const today = new Date();
  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [workouts, setWorkouts] = useState<WorkoutStub[]>([]);
  const [calError, setCalError] = useState<string | null>(null);

  // ── Planner projection state ──
  const [projectedDates, setProjectedDates] = useState<Map<string, DayCard[]>>(new Map());

  // Day modal
  const [modalDay, setModalDay] = useState<number | null>(null);
  const dayWorkouts = useMemo(() => {
    if (modalDay == null) return [];
    const key = isoDate(new Date(calYear, calMonth, modalDay));
    return workouts.filter(w => w.date === key);
  }, [modalDay, workouts, calYear, calMonth]);

  const dayPlannedCards = useMemo(() => {
    if (modalDay == null) return [] as DayCard[];
    const key = isoDate(new Date(calYear, calMonth, modalDay));
    return projectedDates.get(key) ?? [];
  }, [modalDay, projectedDates, calYear, calMonth]);

  // ── Exercise progress state ──
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showExPicker, setShowExPicker] = useState(false);
  const [pickerTab, setPickerTab]       = useState<'all' | MuscleGroup>('all');
  const [trackedList, setTrackedList]   = useState<TrackedExercise[]>([]);

  useEffect(() => { loadAllExercises(); }, []);
  useEffect(() => { loadCalendar(); }, [calYear, calMonth]);

  // Re-fetch active plan whenever this tab comes into focus
  useFocusEffect(useCallback(() => { loadActivePlan(); }, []));

  async function loadCalendar() {
    setCalError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('workouts')
        .select('id, name, date')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      if (error) throw error;
      setWorkouts((data ?? []) as WorkoutStub[]);
    } catch (e: unknown) {
      setCalError(errorMessage(e));
    }
  }

  async function loadActivePlan() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('training_plans')
      .select('id, user_id, plan_type, plan_name, duration_weeks, start_date, schedule, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (data) {
      const projected = generateProjectedDates(data as unknown as TrainingPlan);
      const map = new Map<string, DayCard[]>();
      for (const p of projected) map.set(p.date, p.cards);
      setProjectedDates(map);
    } else {
      setProjectedDates(new Map());
    }
  }

  async function loadAllExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment, is_compound, notes')
      .order('name');
    if (data) setAllExercises(data as Exercise[]);
  }

  async function addTrackedExercise(ex: Exercise) {
    if (trackedList.some(t => t.exercise.id === ex.id)) return;
    const placeholder: TrackedExercise = {
      exercise: ex, chartPoints: null, historyRows: null, chartError: null,
    };
    setTrackedList(prev => [...prev, placeholder]);
    setShowExPicker(false);
    await loadExerciseData(ex);
  }

  async function loadExerciseData(ex: Exercise) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = isoDate(thirtyDaysAgo);

      // Chart: max weight per workout session in the last 30 days, filtered to this user
      const { data: setData, error: setError } = await supabase
        .from('workout_sets')
        .select('weight_lbs, workouts(id, date, user_id)')
        .eq('exercise_id', ex.id)
        .gte('workouts.date', cutoff)
        .not('weight_lbs', 'is', null);

      if (setError) throw setError;

      type SetRow = { weight_lbs: number; workouts: { id: string; date: string; user_id: string } | null };
      const rows = (setData ?? []) as unknown as SetRow[];
      // RLS alone isn't sufficient here because the join may return other users' sets
      const userRows = rows.filter(r => r.workouts?.user_id === user.id && r.workouts?.date >= cutoff);

      // Group by date, take max weight per session
      const byDate = new Map<string, number>();
      for (const r of userRows) {
        if (!r.workouts) continue;
        const d = r.workouts.date;
        byDate.set(d, Math.max(byDate.get(d) ?? 0, r.weight_lbs));
      }
      const chartPoints: ChartPoint[] = [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }));

      // History: all workouts (any date) that include this exercise, deduped
      const { data: histData, error: histError } = await supabase
        .from('workout_sets')
        .select('workouts(id, name, date, user_id)')
        .eq('exercise_id', ex.id);

      if (histError) throw histError;

      type HistRow = { workouts: { id: string; name: string; date: string; user_id: string } | null };
      const histRows = (histData ?? []) as unknown as HistRow[];
      const seen = new Set<string>();
      const historyRows = histRows
        .filter(r => r.workouts?.user_id === user.id)
        .map(r => r.workouts!)
        .filter(w => { if (seen.has(w.id)) return false; seen.add(w.id); return true; })
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(w => ({ workoutName: w.name, date: w.date }));

      setTrackedList(prev => prev.map(t =>
        t.exercise.id === ex.id ? { ...t, chartPoints, historyRows, chartError: null } : t
      ));
    } catch (e: unknown) {
      setTrackedList(prev => prev.map(t =>
        t.exercise.id === ex.id
          ? { ...t, chartPoints: [], historyRows: [], chartError: errorMessage(e) }
          : t
      ));
    }
  }

  function removeTracked(id: string) {
    setTrackedList(prev => prev.filter(t => t.exercise.id !== id));
  }

  // ── Derived data ──
  const calGrid     = useMemo(() => buildCalendarGrid(calYear, calMonth), [calYear, calMonth]);
  const workoutDates = useMemo(() => new Set(workouts.map(w => w.date)), [workouts]);
  const todayIso    = isoDate(today);

  const pickerExercises = useMemo(() => {
    if (pickerTab === 'all') return allExercises;
    return allExercises.filter(e => e.muscle_group === pickerTab);
  }, [allExercises, pickerTab]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── SECTION 1: CONSISTENCY CALENDAR ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Consistency</Text>

        <View style={styles.monthNav}>
          <Pressable onPress={prevMonth} style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <Pressable onPress={nextMonth} style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>›</Text>
          </Pressable>
        </View>

        {calError ? (
          <Text style={styles.errorText}>{calError}</Text>
        ) : (
          <View style={styles.calendarWrap}>
            <View style={styles.calRow}>
              {DAY_LABELS.map(l => (
                <View key={l} style={styles.calCell}>
                  <Text style={styles.calDayLabel}>{l}</Text>
                </View>
              ))}
            </View>

            {calGrid.map((row, ri) => (
              <View key={ri} style={styles.calRow}>
                {row.map((day, ci) => {
                  if (!day) return <View key={ci} style={styles.calCell} />;

                  const iso = isoDate(new Date(calYear, calMonth, day));
                  const hasWorkout = workoutDates.has(iso);
                  const isToday   = iso === todayIso;
                  // Projected: future planned day with no logged workout yet
                  const isPlanned = !hasWorkout && iso >= todayIso && projectedDates.has(iso);
                  const isTappable = hasWorkout || isPlanned;

                  return (
                    <Pressable
                      key={ci}
                      style={styles.calCell}
                      onPress={() => isTappable ? setModalDay(day) : undefined}
                    >
                      <View style={[
                        styles.calDayCircle,
                        hasWorkout && styles.calDayCircleFilled,
                        isPlanned && styles.calDayCirclePlanned,
                        !hasWorkout && !isPlanned && isToday && styles.calDayCircleToday,
                      ]}>
                        <Text style={[
                          styles.calDayNum,
                          (hasWorkout || isPlanned) && styles.calDayNumFilled,
                          isToday && !hasWorkout && !isPlanned && styles.calDayNumToday,
                        ]}>
                          {day}
                        </Text>
                      </View>
                      {isToday && (
                        <View style={[
                          styles.todayDot,
                          (hasWorkout || isPlanned) && styles.todayDotOnFilled,
                        ]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Calendar legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.legendText}>Logged</Text>
          </View>
          {projectedDates.size > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.secondary }]} />
              <Text style={styles.legendText}>Planned</Text>
            </View>
          )}
          <View style={styles.legendItem}>
            <View style={[styles.legendRing, { borderColor: Colors.primary }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
        </View>
      </View>

      {/* ── SECTION 2: EXERCISE PROGRESS ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>Exercise Progress</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowExPicker(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      {trackedList.length === 0 && (
        <Text style={styles.emptyHint}>
          Tap + to add an exercise and track your progress over time.
        </Text>
      )}

      {trackedList.map(tracked => {
        const pr = tracked.chartPoints && tracked.chartPoints.length > 0
          ? Math.max(...tracked.chartPoints.map(p => p.value))
          : null;

        return (
          <View key={tracked.exercise.id} style={styles.exCard}>
            <Pressable
              style={styles.removeBtn}
              onPress={() => removeTracked(tracked.exercise.id)}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>

            <Text style={styles.exName}>{tracked.exercise.name}</Text>
            <Text style={styles.exMuscle}>{tracked.exercise.muscle_group}</Text>

            {tracked.chartError ? (
              <Text style={styles.errorText}>{tracked.chartError}</Text>
            ) : tracked.chartPoints === null ? (
              <Text style={styles.loadingText}>Loading chart…</Text>
            ) : tracked.chartPoints.length < 2 ? (
              <Text style={styles.noDataText}>
                Not enough data yet — log this exercise in at least 2 workouts to see your trend.
              </Text>
            ) : (
              <>
                {pr !== null && (
                  <Text style={styles.prText}>PR: {pr} lbs</Text>
                )}
                <LineChart
                  points={tracked.chartPoints}
                  color={Colors.primary}
                  yFormat={v => Math.round(v).toString()}
                />
              </>
            )}

            <Text style={[styles.sectionLabel, styles.loggedInLabel]}>Logged In</Text>
            {tracked.historyRows === null ? (
              <Text style={styles.loadingText}>Loading history…</Text>
            ) : tracked.historyRows.length === 0 ? (
              <Text style={styles.noDataText}>No workout history yet.</Text>
            ) : (
              <ScrollView style={styles.historyScroll} nestedScrollEnabled scrollEnabled>
                {tracked.historyRows.map((row, i) => (
                  <View
                    key={i}
                    style={[styles.historyRow, i < tracked.historyRows!.length - 1 && styles.historyRowBorder]}
                  >
                    <Text style={styles.historyName} numberOfLines={1}>{row.workoutName}</Text>
                    <Text style={styles.historyDate}>{formatShortDate(row.date)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })}

      {/* ── Day workout modal ── */}
      <Modal
        visible={modalDay !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalDay(null)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalHeading}>
            {modalDay !== null ? formatFullDate(calYear, calMonth, modalDay) : ''}
          </Text>

          <ScrollView style={styles.modalScroll}>
            {dayWorkouts.length > 0 && (
              <>
                {dayPlannedCards.length > 0 && (
                  <Text style={styles.modalSectionLabel}>Logged</Text>
                )}
                {dayWorkouts.map(w => (
                  <Pressable
                    key={w.id}
                    style={styles.modalWorkoutCard}
                    onPress={() => { setModalDay(null); router.push(`/workout-detail/${w.id}`); }}
                  >
                    <Text style={styles.modalWorkoutName}>{w.name}</Text>
                    <Text style={styles.modalChevron}>›</Text>
                  </Pressable>
                ))}
              </>
            )}

            {dayPlannedCards.length > 0 && (
              <>
                {dayWorkouts.length > 0 && <View style={styles.modalDivider} />}
                <Text style={styles.modalSectionLabel}>Planned</Text>
                <View style={styles.modalPlannedChips}>
                  {dayPlannedCards.filter(c => c.category !== 'rest').map(c => (
                    <View key={c.id} style={[styles.modalPlannedChip, { borderColor: Colors.border, backgroundColor: Colors.surfaceAlt }]}>
                      <Text style={[styles.modalPlannedChipText, { color: Colors.text }]}>{c.name}</Text>
                    </View>
                  ))}
                  {dayPlannedCards.every(c => c.category === 'rest') && (
                    <Text style={[styles.modalPlannedChipText, { color: Colors.textSecondary }]}>Rest Day</Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <Pressable style={styles.modalCloseBtn} onPress={() => setModalDay(null)}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Exercise picker modal ── */}
      <Modal
        visible={showExPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalTitleRow}>
            <Text style={styles.modalHeading}>Add Exercise</Text>
            <Pressable onPress={() => setShowExPicker(false)}>
              <Text style={styles.modalCancelLink}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerTabRow}
            contentContainerStyle={styles.pickerTabContent}
          >
            {MUSCLE_GROUPS.map(g => (
              <Pressable
                key={g.key}
                style={[styles.pickerTab, pickerTab === g.key && styles.pickerTabActive]}
                onPress={() => setPickerTab(g.key)}
              >
                <Text style={[styles.pickerTabText, pickerTab === g.key && styles.pickerTabTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <FlatList
            data={pickerExercises}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const alreadyTracked = trackedList.some(t => t.exercise.id === item.id);
              return (
                <Pressable
                  style={[styles.pickerItem, alreadyTracked && styles.pickerItemDisabled]}
                  onPress={() => { if (!alreadyTracked) addTrackedExercise(item); }}
                >
                  <View>
                    <Text style={[styles.pickerItemName, alreadyTracked && styles.pickerItemNameDim]}>
                      {item.name}
                    </Text>
                    <Text style={styles.pickerItemSub}>{item.muscle_group}</Text>
                  </View>
                  {alreadyTracked && (
                    <Text style={styles.pickerItemTracked}>Tracking</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.noDataText}>No exercises found.</Text>
            }
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  errorText: { color: Colors.danger, fontSize: FontSize.sm, marginTop: Spacing.sm },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },
  noDataText: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    marginTop: Spacing.sm, lineHeight: 20,
  },
  emptyHint: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    marginBottom: Spacing.lg, textAlign: 'center',
  },

  addBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '600' },

  // ── Calendar ──
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  monthArrow: { padding: Spacing.sm },
  monthArrowText: { fontSize: 22, color: Colors.primary, fontWeight: '700' },
  monthTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  calendarWrap: {},
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  calDayLabel: {
    fontSize: 10, color: Colors.textDisabled, fontWeight: '600',
    textTransform: 'uppercase',
  },
  calDayCircle: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  calDayCircleFilled: { backgroundColor: Colors.primary },
  calDayCirclePlanned: { backgroundColor: Colors.secondary },
  calDayCircleToday: { borderWidth: 1.5, borderColor: Colors.primary },
  calDayNum: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  calDayNumFilled: { color: '#fff', fontWeight: '700' },
  calDayNumToday: { color: Colors.primary, fontWeight: '700' },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.primary, marginTop: 2,
  },
  todayDotOnFilled: { backgroundColor: '#fff' },

  // ── Calendar legend ──
  legend: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // ── Exercise cards ──
  exCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  removeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, padding: 4 },
  removeBtnText: { color: Colors.danger, fontSize: FontSize.md },
  exName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginRight: 28 },
  exMuscle: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: Spacing.sm,
  },
  prText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '700', marginBottom: Spacing.sm },
  loggedInLabel: { marginTop: Spacing.md, marginBottom: Spacing.xs },

  historyScroll: { maxHeight: 160 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  historyName: { flex: 1, fontSize: FontSize.sm, color: Colors.text, marginRight: Spacing.sm },
  historyDate: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // ── Day modal ──
  modalContainer: {
    flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, paddingTop: Spacing.xl,
  },
  modalTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.lg,
  },
  modalHeading: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg,
  },
  modalScroll: { flex: 1 },
  modalWorkoutCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalWorkoutName: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500', flex: 1 },
  modalChevron: { fontSize: 20, color: Colors.textSecondary },
  modalCloseBtn: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalCloseBtnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  modalCancelLink: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  modalSectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  modalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  modalPlannedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  modalPlannedChip: {
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  modalPlannedChipText: { fontSize: FontSize.sm, fontWeight: '600' },

  // ── Exercise picker modal ──
  pickerTabRow: { height: 44, marginBottom: Spacing.sm },
  pickerTabContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  pickerTab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, marginRight: 6,
  },
  pickerTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerTabText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  pickerTabTextActive: { color: '#fff' },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemDisabled: { opacity: 0.45 },
  pickerItemName: { fontSize: FontSize.md, color: Colors.text },
  pickerItemNameDim: { color: Colors.textSecondary },
  pickerItemSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  pickerItemTracked: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
});
