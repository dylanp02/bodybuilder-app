// lib/types.ts
// These interfaces describe the shape of your data throughout the entire app.
// Every screen, every database table, and every Claude prompt will reference these.

export interface Profile {
  id: string;                    // Matches Supabase auth user ID
  username: string;
  full_name: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  goal: 'aesthetics' | 'strength' | 'endurance' | 'general';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;                  // e.g. "Bench Press"
  muscle_group: MuscleGroup;
  equipment: string | null;      // e.g. "Barbell", "Dumbbell", "Bodyweight"
  is_compound: boolean;          // Compound = multiple muscle groups (squat, deadlift)
  notes: string | null;
}

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

export interface Workout {
  id: string;
  user_id: string;
  name: string;                  // e.g. "Push Day A"
  date: string;                  // ISO date string: "2026-05-07"
  duration_minutes: number | null;
  notes: string | null;
  perceived_difficulty: 1 | 2 | 3 | 4 | 5 | null;  // RPE scale simplified
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  rpe: number | null;            // Rate of Perceived Exertion 1-10
  notes: string | null;
}

// ─── Planner types ───────────────────────────────────────────────────────────

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
  created_at?: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number | null;
  sleep_quality: 1 | 2 | 3 | 4 | 5 | null;
  calories: number | null;
  protein_grams: number | null;
  energy_level: 1 | 2 | 3 | 4 | 5 | null;
  notes: string | null;          // Free text — this feeds Claude context in Phase 3
}