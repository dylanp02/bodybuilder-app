// lib/types.ts
// Canonical TypeScript interfaces for every Supabase table.
// All screens and edge functions should import from here rather than defining inline types.

// ─── Auth / Profile ───────────────────────────────────────────────────────────

export interface Profile {
  id: string;                    // FK → auth.users
  username: string;
  full_name: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  age: number | null;
  gender: 'male' | 'female' | 'prefer_not_to_say' | null;
  goal: 'aesthetics' | 'strength' | 'endurance' | 'general';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  onboarding_complete: boolean;
  is_pro: boolean;
  push_token: string | null;
  created_at: string;
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: string | null;
  is_compound: boolean;
  notes: string | null;
  user_id: string | null;        // null = shared library; non-null = user-created
  created_at: string;
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export interface Workout {
  id: string;
  user_id: string;
  name: string;
  date: string;                  // ISO date: "2026-05-10"
  duration_minutes: number | null;
  notes: string | null;
  perceived_difficulty: 1 | 2 | 3 | 4 | 5 | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  rpe: number | null;            // Rate of Perceived Exertion 1–10
  notes: string | null;
}

// ─── Workout Templates ────────────────────────────────────────────────────────

export interface TemplateSetEntry {
  reps: string;
  weight: string;
  isWarmup: boolean;
}

export interface TemplateExerciseData {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  equipment: string | null;
  isCompound: boolean;
  sets: TemplateSetEntry[];
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  exercises: TemplateExerciseData[];
  created_at: string;
}

// ─── Progress / Tracking ──────────────────────────────────────────────────────

export interface WeightLog {
  id: string;
  user_id: string;
  weight_lbs: number;
  date: string;
  created_at: string;
}

export interface Measurement {
  id: string;
  user_id: string;
  date: string;
  neck_in: number | null;
  chest_in: number | null;
  shoulders_in: number | null;
  biceps_in: number | null;
  forearms_in: number | null;
  thighs_in: number | null;
  calves_in: number | null;
  waist_in: number | null;
  hips_in: number | null;
  created_at: string;
}

export type TopSetType = 'one_rep_max' | 'rep_pr' | 'volume_pr';

export interface TopSet {
  id: string;
  user_id: string;
  exercise_id: string;
  set_type: TopSetType;
  reps: number | null;           // null for one_rep_max
  weight_lbs: number;
  created_at: string;
}

// ─── Daily Log ────────────────────────────────────────────────────────────────

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number | null;
  sleep_quality: 1 | 2 | 3 | 4 | 5 | null;
  calories: number | null;
  protein_grams: number | null;
  energy_level: 1 | 2 | 3 | 4 | 5 | null;
  notes: string | null;
}

// ─── Training Plans ───────────────────────────────────────────────────────────

export type CardCategory = 'muscle' | 'cardio' | 'rest';

export interface DayCard {
  id: string;
  name: string;
  subtitle: string;
  category: CardCategory;
}

export interface CycleDay {
  id: string;
  label: string;
  cards: DayCard[];
}

export type WeekDayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type WeeklySchedule = Record<WeekDayKey, DayCard[]>;
export interface CycleSchedule { days: CycleDay[]; }

export interface TrainingPlan {
  id: string;
  user_id: string;
  plan_type: 'weekly' | 'cycle';
  plan_name: string;
  duration_weeks: number;
  start_date: string;
  schedule: WeeklySchedule | CycleSchedule;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
