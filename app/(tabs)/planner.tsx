/*
 * ─── SQL — paste into Supabase SQL editor before using this screen ───────────
 *
 * -- Training plans table
 * create table public.training_plans (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users(id) on delete cascade,
 *   plan_type text not null check (plan_type in ('weekly', 'cycle')),
 *   plan_name text not null,
 *   duration_weeks integer not null default 8,
 *   start_date date not null,
 *   schedule jsonb not null,
 *   -- For weekly: { "Mon": [card, ...], "Tue": [...], ... }
 *   -- For cycle:  { "days": [ { label: "Day 1", cards: [...] }, ... ] }
 *   is_active boolean default true,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 *
 * -- Only one active plan per user at a time
 * create unique index one_active_plan_per_user
 *   on public.training_plans (user_id)
 *   where is_active = true;
 *
 * -- RLS
 * alter table public.training_plans enable row level security;
 * create policy "Users manage own plans"
 *   on public.training_plans for all
 *   using (auth.uid() = user_id);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// app/(tabs)/planner.tsx — premium training plan builder (unlocked for testing)
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { useProContext } from '../../lib/ProContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';
import {
  TrainingPlan, DayCard, CycleDay,
  WeekDayKey, WeeklySchedule, CycleSchedule, CardCategory,
} from '../../lib/types';
import { generateProjectedDates } from '../../lib/planProjection';
import { isoDate, formatShortDate, formatLongDate } from '../../lib/utils';
import { forceRescheduleNotifications } from '../../lib/notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS: WeekDayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CARD_GROUPS: { label: string; cards: Omit<DayCard, 'id'>[] }[] = [
  {
    label: 'Muscle Groups',
    cards: [
      { name: 'Push',       subtitle: 'Chest / Shoulders / Triceps', category: 'muscle' },
      { name: 'Pull',       subtitle: 'Back / Biceps',               category: 'muscle' },
      { name: 'Legs',       subtitle: 'Quads / Hamstrings / Glutes', category: 'muscle' },
      { name: 'Upper Body', subtitle: '',                            category: 'muscle' },
      { name: 'Lower Body', subtitle: '',                            category: 'muscle' },
      { name: 'Full Body',  subtitle: '',                            category: 'muscle' },
      { name: 'Arms',       subtitle: 'Biceps / Triceps',            category: 'muscle' },
      { name: 'Core',       subtitle: '',                            category: 'muscle' },
    ],
  },
  {
    label: 'Cardio',
    cards: [
      { name: 'LISS Cardio', subtitle: 'Low intensity steady state', category: 'cardio' },
      { name: 'HIIT',        subtitle: 'High intensity intervals',   category: 'cardio' },
      { name: 'Zone 2',      subtitle: 'Aerobic base building',      category: 'cardio' },
      { name: 'Sprints',     subtitle: '',                           category: 'cardio' },
      { name: 'Cycling',     subtitle: '',                           category: 'cardio' },
      { name: 'Swimming',    subtitle: '',                           category: 'cardio' },
    ],
  },
  {
    label: 'Rest / Recovery',
    cards: [
      { name: 'Rest Day',        subtitle: 'Full rest',                category: 'rest' },
      { name: 'Active Recovery', subtitle: 'Light movement or walk',   category: 'rest' },
      { name: 'Deload',          subtitle: 'Reduced volume week',      category: 'rest' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function cardAccent(category: CardCategory, Colors: AppColors): string {
  if (category === 'muscle') return Colors.primary;
  if (category === 'cardio') return Colors.secondary;
  return Colors.border;
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekProgress(startDate: string, durationWeeks: number): string {
  const start = parseLocal(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const week = Math.max(1, Math.min(Math.floor(days / 7) + 1, durationWeeks));
  return `Week ${week} of ${durationWeeks}`;
}

function getCyclePosition(startDate: string, days: CycleDay[]): string {
  if (!days.length) return '';
  const start = parseLocal(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const pos = Math.max(0, elapsed % days.length) + 1;
  return `Today is Day ${pos} of ${days.length}`;
}

function emptyWeekly(): WeeklySchedule {
  return { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
}

// ─── Card chip component ──────────────────────────────────────────────────────

function CardChip({
  card, onRemove, Colors,
}: { card: DayCard; onRemove?: () => void; Colors: AppColors }) {
  const accent = cardAccent(card.category, Colors);
  return (
    <View style={[chipStyles.chip, { borderLeftColor: accent }]}>
      <Text style={[chipStyles.name, { color: Colors.text }]} numberOfLines={1}>
        {card.name}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={[chipStyles.remove, { color: Colors.textDisabled }]}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, paddingLeft: 8, paddingRight: 10,
    paddingVertical: 4, marginRight: 8,
    backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 4,
  },
  name: { fontSize: 12, fontWeight: '600', marginRight: 4 },
  remove: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type PlannerState = 'loading' | 'no_plan' | 'building' | 'active';

// PickerTarget must be declared outside the component so the type is stable
type PickerTarget =
  | { type: 'weekly'; day: WeekDayKey }
  | { type: 'cycle'; dayId: string };

export default function PlannerScreen() {
  const { isPro } = useProContext();
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // ── Top-level state machine ──
  const [plannerState, setPlannerState] = useState<PlannerState>('loading');
  const [activePlan, setActivePlan]     = useState<TrainingPlan | null>(null);

  // ── Builder state ──
  const [buildStep, setBuildStep]       = useState<1 | 2 | 3 | 4>(1);
  const [planType, setPlanType]         = useState<'weekly' | 'cycle' | null>(null);
  const [planName, setPlanName]         = useState('');
  const [startDate, setStartDate]       = useState(isoDate(new Date()));
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(emptyWeekly);
  const [cycleDays, setCycleDays]       = useState<CycleDay[]>([
    { id: uid(), label: 'Day 1', cards: [] },
  ]);

  // ── Card picker ──
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget]   = useState<PickerTarget | null>(null);

  // ── Save indicator ──
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    console.log('isPro in planner:', isPro);
    if (!isPro) { setPlannerState('no_plan'); return; }
    loadActivePlan();
  }, [isPro]);

  if (!isPro) {
    return (
      <View style={styles.screen}>
        <View style={styles.proGate}>
          <Text style={styles.proGateTitle}>Training Planner</Text>
          <Text style={styles.proGateSub}>
            Build a structured training plan with weekly or cycle-based programming.
          </Text>
          <Pressable style={styles.proGateBtn} onPress={() => router.push('/subscription')}>
            <Text style={styles.proGateBtnText}>View Pro Plan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Data functions ────────────────────────────────────────────────────────

  async function loadActivePlan() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPlannerState('no_plan'); return; }

    const { data } = await supabase
      .from('training_plans')
      .select('id, user_id, plan_type, plan_name, duration_weeks, start_date, schedule, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setActivePlan(data as unknown as TrainingPlan);
      setPlannerState('active');
    } else {
      setPlannerState('no_plan');
    }
  }

  async function savePlan() {
    if (!planName.trim()) { Alert.alert('Enter a plan name'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const schedule: WeeklySchedule | CycleSchedule =
      planType === 'weekly' ? weeklySchedule : { days: cycleDays };

    const payload = {
      user_id: user.id,
      plan_type: planType!,
      plan_name: planName.trim(),
      duration_weeks: durationWeeks,
      start_date: startDate,
      schedule,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('training_plans')
      .insert(payload)
      .select()
      .single();

    setSaving(false);
    if (error) { Alert.alert('Error saving plan', error.message); return; }
    const saved = data as unknown as TrainingPlan;
    setActivePlan(saved);
    setPlannerState('active');
    forceRescheduleNotifications(user.id, saved);
  }

  async function cancelPlan() {
    if (!activePlan) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('training_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', activePlan.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setActivePlan(null);
    forceRescheduleNotifications(user.id, null);
  }

  // ── Builder navigation ────────────────────────────────────────────────────

  function startBuilding() {
    setPlanType(null);
    setPlanName('');
    setStartDate(isoDate(new Date()));
    setDurationWeeks(8);
    setWeeklySchedule(emptyWeekly());
    setCycleDays([{ id: uid(), label: 'Day 1', cards: [] }]);
    setBuildStep(1);
    setPlannerState('building');
  }

  function confirmCancelBuild() {
    Alert.alert('Discard this plan?', 'Your progress on this plan will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setPlannerState('no_plan') },
    ]);
  }

  function confirmCancelActive(andStartNew: boolean) {
    Alert.alert(
      'Cancel your current plan?',
      'Your workout history is kept.',
      [
        { text: 'Keep plan', style: 'cancel' },
        {
          text: 'Cancel plan', style: 'destructive',
          onPress: async () => {
            await cancelPlan();
            if (andStartNew) { startBuilding(); } else { setPlannerState('no_plan'); }
          },
        },
      ]
    );
  }

  // ── Cycle day helpers ─────────────────────────────────────────────────────

  function addCycleDay(isRest: boolean) {
    const idx = cycleDays.length + 1;
    setCycleDays(prev => [
      ...prev,
      {
        id: uid(),
        label: isRest ? 'Rest' : `Day ${idx}`,
        cards: isRest ? [{ id: uid(), name: 'Rest Day', subtitle: 'Full rest', category: 'rest' }] : [],
      },
    ]);
  }

  function removeCycleDay(dayId: string) {
    setCycleDays(prev => prev.filter(d => d.id !== dayId));
  }

  function moveCycleDay(index: number, dir: 'up' | 'down') {
    setCycleDays(prev => {
      const next = [...prev];
      const to = dir === 'up' ? index - 1 : index + 1;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function updateCycleDayLabel(dayId: string, label: string) {
    setCycleDays(prev => prev.map(d => d.id === dayId ? { ...d, label } : d));
  }

  // ── Card picker ───────────────────────────────────────────────────────────

  function openPicker(target: PickerTarget) {
    setPickerTarget(target);
    setPickerVisible(true);
  }

  function pickCard(template: Omit<DayCard, 'id'>) {
    const card: DayCard = { id: uid(), ...template };
    if (!pickerTarget) return;

    if (pickerTarget.type === 'weekly') {
      const day = pickerTarget.day;
      setWeeklySchedule(prev => ({ ...prev, [day]: [...prev[day], card] }));
    } else {
      const dayId = pickerTarget.dayId;
      setCycleDays(prev => prev.map(d =>
        d.id === dayId ? { ...d, cards: [...d.cards, card] } : d
      ));
    }
    setPickerVisible(false);
  }

  function removeWeeklyCard(day: WeekDayKey, cardId: string) {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: prev[day].filter(c => c.id !== cardId),
    }));
  }

  function removeCycleCard(dayId: string, cardId: string) {
    setCycleDays(prev => prev.map(d =>
      d.id === dayId ? { ...d, cards: d.cards.filter(c => c.id !== cardId) } : d
    ));
  }

  // ── Derived active plan data ──────────────────────────────────────────────

  const upcoming7 = useMemo(() => {
    if (!activePlan) return [];
    const projected = generateProjectedDates(activePlan);
    const projMap   = new Map(projected.map(p => [p.date, p.cards]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = isoDate(d);
      return {
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        cards: projMap.get(iso) ?? [],
        isRest: !projMap.has(iso),
      };
    });
  }, [activePlan]);

  const upNextCards = useMemo(() => {
    if (!activePlan) return [];
    const projected = generateProjectedDates(activePlan);
    return projected.length > 0 ? projected[0].cards : [];
  }, [activePlan]);

  const activeCycleDays = activePlan?.plan_type === 'cycle'
    ? (activePlan.schedule as CycleSchedule).days
    : [];

  const activeCyclePos = activePlan?.plan_type === 'cycle'
    ? (() => {
        const start = parseLocal(activePlan.start_date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
        return Math.max(0, elapsed % activeCycleDays.length);
      })()
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (plannerState === 'loading') {
    return (
      <View style={styles.screen}>

        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </View>
    );
  }

  // ── no_plan ───────────────────────────────────────────────────────────────

  if (plannerState === 'no_plan') {
    return (
      <View style={styles.screen}>

      <ScrollView style={styles.container} contentContainerStyle={styles.centeredContent}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Planner</Text>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
        </View>
        <Text style={styles.proSub}>Unlocked for testing</Text>

        <Text style={styles.explainer}>
          Build a training plan to see upcoming workouts on your calendar and always know what's next.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={startBuilding}>
          <Text style={styles.primaryBtnText}>Create New Plan</Text>
        </Pressable>
      </ScrollView>
      </View>
    );
  }

  // ── building ──────────────────────────────────────────────────────────────

  if (plannerState === 'building') {
    return (
      <View style={styles.screen}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <Pressable style={styles.backRow} onPress={confirmCancelBuild}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Step 1 — Plan type */}
        {buildStep === 1 && (
          <>
            <Text style={styles.stepHeader}>New Plan — Step 1 of 4</Text>
            <Text style={styles.stepQuestion}>How is your training structured?</Text>

            <View style={styles.typeCardRow}>
              <Pressable
                style={[styles.typeCard, planType === 'weekly' && styles.typeCardSelected]}
                onPress={() => setPlanType('weekly')}
              >
                <Text style={styles.typeCardIcon}>📅</Text>
                <Text style={[styles.typeCardTitle, { color: Colors.text }]}>7-Day Schedule</Text>
                <Text style={[styles.typeCardSub, { color: Colors.textSecondary }]}>
                  Your split repeats weekly. Example: Push Mon/Thu, Pull Tue/Fri, Legs Wed/Sat.
                </Text>
              </Pressable>

              <Pressable
                style={[styles.typeCard, planType === 'cycle' && styles.typeCardSelected]}
                onPress={() => setPlanType('cycle')}
              >
                <Text style={styles.typeCardIcon}>🔄</Text>
                <Text style={[styles.typeCardTitle, { color: Colors.text }]}>Continuous Cycle</Text>
                <Text style={[styles.typeCardSub, { color: Colors.textSecondary }]}>
                  Your split runs on its own cadence regardless of the day of week. Example: 3 on, 1 rest, repeat.
                </Text>
              </Pressable>
            </View>

            {planType && (
              <Pressable style={styles.primaryBtn} onPress={() => setBuildStep(2)}>
                <Text style={styles.primaryBtnText}>Next →</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Step 2 — Plan details */}
        {buildStep === 2 && (
          <>
            <Text style={styles.stepHeader}>New Plan — Step 2 of 4</Text>

            <Text style={styles.fieldLabel}>Plan Name</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. PPL Cycle, 5/3/1, Bro Split'
              placeholderTextColor={Colors.textDisabled}
              value={planName}
              onChangeText={setPlanName}
            />

            <Text style={styles.fieldLabel}>Start Date</Text>
            <View style={styles.datePicker}>
              <Pressable
                style={styles.dateArrow}
                onPress={() => {
                  const [y, m, d] = startDate.split('-').map(Number);
                  const dt = new Date(y, m - 1, d);
                  dt.setDate(dt.getDate() - 1);
                  setStartDate(isoDate(dt));
                }}
              >
                <Text style={styles.dateArrowText}>←</Text>
              </Pressable>
              <Text style={[styles.dateDisplay, { color: Colors.text }]}>
                {formatLongDate(startDate)}
              </Text>
              <Pressable
                style={styles.dateArrow}
                onPress={() => {
                  const [y, m, d] = startDate.split('-').map(Number);
                  const dt = new Date(y, m - 1, d);
                  dt.setDate(dt.getDate() + 1);
                  setStartDate(isoDate(dt));
                }}
              >
                <Text style={styles.dateArrowText}>→</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>
              Duration — how far to project this plan on the calendar
            </Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => setDurationWeeks(w => Math.max(1, w - 1))}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: Colors.text }]}>
                {durationWeeks} {durationWeeks === 1 ? 'week' : 'weeks'}
              </Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => setDurationWeeks(w => Math.min(52, w + 1))}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.navRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setBuildStep(1)}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.navBtn]}
                onPress={() => {
                  if (!planName.trim()) { Alert.alert('Enter a plan name'); return; }
                  setBuildStep(3);
                }}
              >
                <Text style={styles.primaryBtnText}>Next →</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Step 3 — Build schedule */}
        {buildStep === 3 && planType === 'weekly' && (
          <>
            <Text style={styles.stepHeader}>New Plan — Step 3 of 4</Text>
            <Text style={styles.stepQuestion}>Assign training cards to each day.</Text>

            {WEEK_DAYS.map(day => (
              <View key={day} style={styles.weekRow}>
                <Text style={[styles.weekDayLabel, { color: Colors.textSecondary }]}>{day}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.cardTray}
                  contentContainerStyle={styles.cardTrayContent}
                >
                  {weeklySchedule[day].map(card => (
                    <CardChip
                      key={card.id}
                      card={card}
                      onRemove={() => removeWeeklyCard(day, card.id)}
                      Colors={Colors}
                    />
                  ))}
                  <Pressable
                    style={[styles.addCardBtn, { borderColor: Colors.border }]}
                    onPress={() => openPicker({ type: 'weekly', day })}
                  >
                    <Text style={[styles.addCardBtnText, { color: Colors.primary }]}>+ Add</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ))}

            <View style={styles.navRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setBuildStep(2)}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.navBtn]} onPress={() => setBuildStep(4)}>
                <Text style={styles.primaryBtnText}>Next →</Text>
              </Pressable>
            </View>
          </>
        )}

        {buildStep === 3 && planType === 'cycle' && (
          <>
            <Text style={styles.stepHeader}>New Plan — Step 3 of 4</Text>
            <Text style={styles.stepQuestion}>Build your cycle in order.</Text>

            {cycleDays.map((day, idx) => (
              <View key={day.id} style={styles.cycleDayRow}>
                {/* Reorder controls — up/down button reordering */}
                <View style={styles.reorderCol}>
                  <Pressable
                    onPress={() => moveCycleDay(idx, 'up')}
                    disabled={idx === 0}
                    style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                  >
                    <Text style={styles.reorderBtnText}>▲</Text>
                  </Pressable>
                  <Text style={[styles.dragHandle, { color: Colors.textDisabled }]}>≡</Text>
                  <Pressable
                    onPress={() => moveCycleDay(idx, 'down')}
                    disabled={idx === cycleDays.length - 1}
                    style={[styles.reorderBtn, idx === cycleDays.length - 1 && styles.reorderBtnDisabled]}
                  >
                    <Text style={styles.reorderBtnText}>▼</Text>
                  </Pressable>
                </View>

                <View style={styles.cycleDayBody}>
                  <View style={styles.cycleDayHeader}>
                    <TextInput
                      style={[styles.cycleDayLabel, { color: Colors.text, borderColor: Colors.border }]}
                      value={day.label}
                      onChangeText={v => updateCycleDayLabel(day.id, v)}
                    />
                    {cycleDays.length > 1 && (
                      <Pressable onPress={() => removeCycleDay(day.id)} hitSlop={8}>
                        <Text style={[styles.cycleRemove, { color: Colors.danger }]}>✕</Text>
                      </Pressable>
                    )}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.cardTray}
                    contentContainerStyle={styles.cardTrayContent}
                  >
                    {day.cards.map(card => (
                      <CardChip
                        key={card.id}
                        card={card}
                        onRemove={() => removeCycleCard(day.id, card.id)}
                        Colors={Colors}
                      />
                    ))}
                    <Pressable
                      style={[styles.addCardBtn, { borderColor: Colors.border }]}
                      onPress={() => openPicker({ type: 'cycle', dayId: day.id })}
                    >
                      <Text style={[styles.addCardBtnText, { color: Colors.primary }]}>+ Add</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              </View>
            ))}

            <View style={styles.cycleAddRow}>
              <Pressable style={[styles.cycleAddBtn, { borderColor: Colors.border }]} onPress={() => addCycleDay(false)}>
                <Text style={[styles.cycleAddBtnText, { color: Colors.text }]}>+ Training Day</Text>
              </Pressable>
              <Pressable style={[styles.cycleAddBtn, { borderColor: Colors.border }]} onPress={() => addCycleDay(true)}>
                <Text style={[styles.cycleAddBtnText, { color: Colors.textSecondary }]}>+ Rest Day</Text>
              </Pressable>
            </View>

            <View style={styles.navRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setBuildStep(2)}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.navBtn]} onPress={() => setBuildStep(4)}>
                <Text style={styles.primaryBtnText}>Next →</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Step 4 — Confirm */}
        {buildStep === 4 && (
          <>
            <Text style={styles.stepHeader}>New Plan — Step 4 of 4</Text>
            <Text style={styles.stepQuestion}>Review your plan before launching.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{planName}</Text>
              <Text style={styles.summaryMeta}>
                {planType === 'weekly' ? '7-Day Schedule' : 'Continuous Cycle'}
                {' · '}Starting {formatShortDate(startDate)}
                {' · '}{durationWeeks} weeks
              </Text>

              <View style={styles.divider} />

              {planType === 'weekly' ? (
                WEEK_DAYS.map(day => (
                  <View key={day} style={styles.summaryRow}>
                    <Text style={[styles.summaryDay, { color: Colors.textSecondary }]}>{day}</Text>
                    <View style={styles.summaryChips}>
                      {weeklySchedule[day].length === 0 ? (
                        <Text style={[styles.summaryEmpty, { color: Colors.textDisabled }]}>—</Text>
                      ) : weeklySchedule[day].map(c => (
                        <Text key={c.id} style={[styles.summaryChip, { backgroundColor: Colors.surfaceAlt, color: Colors.text }]}>
                          {c.name}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                cycleDays.map((day, i) => (
                  <View key={day.id} style={styles.summaryRow}>
                    <Text style={[styles.summaryDay, { color: Colors.textSecondary }]}>{day.label}</Text>
                    <View style={styles.summaryChips}>
                      {day.cards.length === 0 ? (
                        <Text style={[styles.summaryEmpty, { color: Colors.textDisabled }]}>Rest</Text>
                      ) : day.cards.map(c => (
                        <Text key={c.id} style={[styles.summaryChip, { backgroundColor: Colors.surfaceAlt, color: Colors.text }]}>
                          {c.name}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.navRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setBuildStep(3)}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.navBtn, saving && styles.btnDisabled]}
                onPress={savePlan}
                disabled={saving}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Saving...' : 'Launch Plan 🚀'}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Card picker modal */}
        <Modal
          visible={pickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: Colors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: Colors.border }]}>
              <Text style={[styles.pickerTitle, { color: Colors.text }]}>Select Card</Text>
              <Pressable onPress={() => setPickerVisible(false)}>
                <Text style={{ color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.pickerBody}>
              {CARD_GROUPS.map(group => (
                <View key={group.label}>
                  <Text style={[styles.pickerGroupLabel, { color: Colors.textSecondary }]}>
                    {group.label}
                  </Text>
                  {group.cards.map(template => {
                    const accent = cardAccent(template.category, Colors);
                    return (
                      <Pressable
                        key={template.name}
                        style={[styles.pickerItem, { borderLeftColor: accent, backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
                        onPress={() => pickCard(template)}
                      >
                        <Text style={[styles.pickerItemName, { color: Colors.text }]}>{template.name}</Text>
                        {template.subtitle ? (
                          <Text style={[styles.pickerItemSub, { color: Colors.textSecondary }]}>
                            {template.subtitle}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
      </View>
    );
  }

  // ── active ────────────────────────────────────────────────────────────────

  if (plannerState === 'active' && activePlan) {
    const isWeekly  = activePlan.plan_type === 'weekly';
    const weekSched = isWeekly ? (activePlan.schedule as WeeklySchedule) : null;

    return (
      <View style={styles.screen}>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Planner</Text>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
        </View>

        {/* Active plan card */}
        <View style={styles.activePlanCard}>
          <View style={styles.activePlanTitleRow}>
            <Text style={[styles.activePlanName, { color: Colors.text }]} numberOfLines={1}>
              {activePlan.plan_name}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: Colors.primary }]}>
              <Text style={styles.typeBadgeText}>
                {isWeekly ? '7-Day' : 'Cycle'}
              </Text>
            </View>
          </View>

          <Text style={[styles.activePlanMeta, { color: Colors.textSecondary }]}>
            {getWeekProgress(activePlan.start_date, activePlan.duration_weeks)}
            {' · '}Started {formatShortDate(activePlan.start_date)}
          </Text>

          {!isWeekly && (
            <Text style={[styles.activePlanMeta, { color: Colors.textSecondary }]}>
              {getCyclePosition(activePlan.start_date, activeCycleDays)}
            </Text>
          )}

          {upNextCards.length > 0 && (
            <View style={styles.upNextRow}>
              <Text style={[styles.upNextLabel, { color: Colors.primary }]}>UP NEXT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {upNextCards.map(c => (
                  <CardChip key={c.id} card={c} Colors={Colors} />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.dangerOutlineBtn, { borderColor: Colors.danger }]}
              onPress={() => confirmCancelActive(false)}
            >
              <Text style={[styles.dangerOutlineBtnText, { color: Colors.danger }]}>Cancel Plan</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, styles.newPlanBtn]}
              onPress={() => confirmCancelActive(true)}
            >
              <Text style={styles.primaryBtnText}>New Plan</Text>
            </Pressable>
          </View>
        </View>

        {/* This Week (weekly) */}
        {isWeekly && weekSched && (
          <>
            <Text style={styles.sectionLabel}>This Week</Text>
            <View style={styles.weekGrid}>
              {WEEK_DAYS.map(day => (
                <View key={day} style={styles.weekGridCol}>
                  <Text style={[styles.weekGridDayLabel, { color: Colors.textDisabled }]}>{day}</Text>
                  {weekSched[day].length === 0 ? (
                    <Text style={[styles.weekGridEmpty, { color: Colors.textDisabled }]}>—</Text>
                  ) : (
                    weekSched[day].map(c => (
                      <View
                        key={c.id}
                        style={[styles.weekGridChip, { backgroundColor: cardAccent(c.category, Colors) }]}
                      >
                        <Text style={styles.weekGridChipText} numberOfLines={1}>{c.name}</Text>
                      </View>
                    ))
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Cycle Progress (cycle) */}
        {!isWeekly && activeCycleDays.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Cycle Progress</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cycleProgressRow}>
              {activeCycleDays.map((day, idx) => {
                const isCurrent = idx === activeCyclePos;
                const isPast    = idx < activeCyclePos;
                return (
                  <View
                    key={day.id}
                    style={[
                      styles.cycleProgressItem,
                      { backgroundColor: Colors.surface, borderColor: isCurrent ? Colors.primary : Colors.border },
                      isPast && styles.cycleProgressItemPast,
                    ]}
                  >
                    <Text style={[
                      styles.cycleProgressLabel,
                      { color: isCurrent ? Colors.primary : isPast ? Colors.textDisabled : Colors.text },
                    ]}>
                      {day.label}
                    </Text>
                    {day.cards.slice(0, 2).map(c => (
                      <Text key={c.id} style={[styles.cycleProgressCard, { color: Colors.textSecondary }]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Upcoming 7 days */}
        <Text style={styles.sectionLabel}>Upcoming</Text>
        {upcoming7.map(item => (
          <View key={item.label} style={[styles.upcomingRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.upcomingDate, { color: Colors.textSecondary }]}>{item.label}</Text>
            {item.isRest ? (
              <Text style={[styles.upcomingRest, { color: Colors.textDisabled }]}>Rest Day</Text>
            ) : (
              <View style={styles.upcomingChips}>
                {item.cards.filter(c => c.category !== 'rest').map(c => (
                  <Text
                    key={c.id}
                    style={[styles.upcomingChip, { color: cardAccent(c.category, Colors) }]}
                  >
                    {c.name}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      </View>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  proGate: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  proGateTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  proGateSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  proGateBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  proGateBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },

  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  centeredContent: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl, justifyContent: 'center' },
  centered: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  screenTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  proBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  proBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1 },
  proSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  explainer: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22,
  },

  backRow: { marginBottom: Spacing.md },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  stepHeader: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  stepQuestion: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },

  typeCardRow: { gap: Spacing.md, marginBottom: Spacing.xl },
  typeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 2, borderColor: Colors.border,
  },
  typeCardSelected: { borderColor: Colors.primary },
  typeCardIcon: { fontSize: 28, marginBottom: Spacing.sm },
  typeCardTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.xs },
  typeCardSub: { fontSize: FontSize.sm, lineHeight: 20 },

  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md,
    marginBottom: Spacing.sm,
  },

  datePicker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  dateArrow: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateArrowText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  dateDisplay: { flex: 1, fontSize: FontSize.md, fontWeight: '500', textAlign: 'center' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnText: { fontSize: 22, color: Colors.primary, fontWeight: '700', lineHeight: 28 },
  stepperValue: { fontSize: FontSize.md, fontWeight: '600', minWidth: 80, textAlign: 'center' },

  navRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  navBtn: { flex: 1 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  weekRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    marginBottom: Spacing.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  weekDayLabel: { width: 36, fontSize: FontSize.sm, fontWeight: '600' },
  cardTray: { flex: 1 },
  cardTrayContent: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.sm },
  addCardBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  addCardBtnText: { fontSize: 12, fontWeight: '600' },

  cycleDayRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  reorderCol: { width: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt, paddingVertical: Spacing.xs },
  reorderBtn: { padding: 2 },
  reorderBtnDisabled: { opacity: 0.2 },
  reorderBtnText: { fontSize: 11, color: Colors.textSecondary },
  dragHandle: { fontSize: 18, marginVertical: 4 },
  cycleDayBody: { flex: 1, padding: Spacing.sm },
  cycleDayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  cycleDayLabel: {
    flex: 1, fontSize: FontSize.sm, fontWeight: '600',
    borderBottomWidth: 1, paddingVertical: 2, marginRight: Spacing.sm,
  },
  cycleRemove: { fontSize: FontSize.md, fontWeight: '700' },
  cycleAddRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  cycleAddBtn: {
    flex: 1, borderWidth: 1, borderRadius: Radius.sm,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  cycleAddBtnText: { fontSize: FontSize.sm, fontWeight: '600' },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  summaryMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  summaryDay: { width: 36, fontSize: FontSize.sm, fontWeight: '600' },
  summaryChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  summaryChip: { fontSize: FontSize.xs, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  summaryEmpty: { fontSize: FontSize.sm },

  pickerSheet: { flex: 1 },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, paddingTop: Spacing.xl,
    borderBottomWidth: 1,
  },
  pickerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  pickerBody: { padding: Spacing.md },
  pickerGroupLabel: {
    fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1,
    marginTop: Spacing.md, marginBottom: Spacing.xs, marginLeft: Spacing.sm,
  },
  pickerItem: {
    borderLeftWidth: 4, paddingLeft: Spacing.md, paddingRight: Spacing.md,
    paddingVertical: Spacing.md, marginBottom: 2,
    borderBottomWidth: 1,
  },
  pickerItemName: { fontSize: FontSize.md, fontWeight: '600' },
  pickerItemSub: { fontSize: FontSize.sm, marginTop: 2 },

  // ── Active state ──
  activePlanCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  activePlanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  activePlanName: { flex: 1, fontSize: FontSize.lg, fontWeight: '700' },
  typeBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  activePlanMeta: { fontSize: FontSize.sm, marginBottom: 2 },

  upNextRow: { marginTop: Spacing.md },
  upNextLabel: { fontSize: FontSize.xs, fontWeight: '600', letterSpacing: 1, marginBottom: Spacing.xs },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  dangerOutlineBtn: {
    flex: 1, borderWidth: 1, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  dangerOutlineBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  newPlanBtn: { flex: 1, paddingVertical: Spacing.sm },

  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.sm, marginTop: Spacing.sm,
  },

  weekGrid: { flexDirection: 'row', gap: 4, marginBottom: Spacing.lg },
  weekGridCol: { flex: 1, alignItems: 'center' },
  weekGridDayLabel: { fontSize: 10, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  weekGridEmpty: { fontSize: 16 },
  weekGridChip: {
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2, width: '100%',
  },
  weekGridChipText: { color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' },

  cycleProgressRow: { marginBottom: Spacing.lg },
  cycleProgressItem: {
    borderRadius: Radius.md, borderWidth: 1.5, padding: Spacing.sm,
    marginRight: Spacing.sm, minWidth: 72, alignItems: 'center',
  },
  cycleProgressItemPast: { opacity: 0.4 },
  cycleProgressLabel: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 2 },
  cycleProgressCard: { fontSize: 10, textAlign: 'center' },

  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1,
  },
  upcomingDate: { fontSize: FontSize.sm, fontWeight: '500', width: 110 },
  upcomingRest: { fontSize: FontSize.sm },
  upcomingChips: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' },
  upcomingChip: { fontSize: FontSize.sm, fontWeight: '600' },
});
