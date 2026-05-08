-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

CREATE TABLE IF NOT EXISTS exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  muscle_group text NOT NULL,
  equipment text,
  is_compound boolean NOT NULL DEFAULT false,
  notes text
);

INSERT INTO exercises (name, muscle_group, equipment, is_compound) VALUES
  -- Chest
  ('Bench Press',            'chest',     'Barbell',    true),
  ('Incline Bench Press',    'chest',     'Barbell',    true),
  ('Decline Bench Press',    'chest',     'Barbell',    true),
  ('Dumbbell Bench Press',   'chest',     'Dumbbell',   true),
  ('Dumbbell Fly',           'chest',     'Dumbbell',   false),
  ('Cable Fly',              'chest',     'Cable',      false),
  ('Push-Up',                'chest',     'Bodyweight', true),

  -- Back
  ('Deadlift',               'back',      'Barbell',    true),
  ('Pull-Up',                'back',      'Bodyweight', true),
  ('Barbell Row',            'back',      'Barbell',    true),
  ('Dumbbell Row',           'back',      'Dumbbell',   false),
  ('Lat Pulldown',           'back',      'Cable',      false),
  ('Seated Cable Row',       'back',      'Cable',      false),
  ('T-Bar Row',              'back',      'Barbell',    true),

  -- Shoulders
  ('Overhead Press',         'shoulders', 'Barbell',    true),
  ('Dumbbell Shoulder Press','shoulders', 'Dumbbell',   true),
  ('Arnold Press',           'shoulders', 'Dumbbell',   true),
  ('Lateral Raise',          'shoulders', 'Dumbbell',   false),
  ('Front Raise',            'shoulders', 'Dumbbell',   false),
  ('Face Pull',              'shoulders', 'Cable',      false),

  -- Biceps
  ('Barbell Curl',           'biceps',    'Barbell',    false),
  ('Dumbbell Curl',          'biceps',    'Dumbbell',   false),
  ('Hammer Curl',            'biceps',    'Dumbbell',   false),
  ('Preacher Curl',          'biceps',    'Barbell',    false),
  ('Cable Curl',             'biceps',    'Cable',      false),
  ('Concentration Curl',     'biceps',    'Dumbbell',   false),

  -- Triceps
  ('Tricep Pushdown',        'triceps',   'Cable',      false),
  ('Skull Crusher',          'triceps',   'Barbell',    false),
  ('Overhead Tricep Extension','triceps', 'Dumbbell',   false),
  ('Close-Grip Bench Press', 'triceps',   'Barbell',    true),
  ('Dips',                   'triceps',   'Bodyweight', true),

  -- Legs
  ('Squat',                  'legs',      'Barbell',    true),
  ('Hack Squat',             'legs',      'Machine',    true),
  ('Leg Press',              'legs',      'Machine',    true),
  ('Romanian Deadlift',      'legs',      'Barbell',    true),
  ('Bulgarian Split Squat',  'legs',      'Dumbbell',   true),
  ('Walking Lunge',          'legs',      'Dumbbell',   true),
  ('Leg Curl',               'legs',      'Machine',    false),
  ('Leg Extension',          'legs',      'Machine',    false),
  ('Calf Raise',             'legs',      'Machine',    false),

  -- Glutes
  ('Hip Thrust',             'glutes',    'Barbell',    false),
  ('Glute Bridge',           'glutes',    'Bodyweight', false),
  ('Cable Kickback',         'glutes',    'Cable',      false),
  ('Sumo Deadlift',          'glutes',    'Barbell',    true),

  -- Core
  ('Plank',                  'core',      'Bodyweight', false),
  ('Crunch',                 'core',      'Bodyweight', false),
  ('Cable Crunch',           'core',      'Cable',      false),
  ('Hanging Leg Raise',      'core',      'Bodyweight', false),
  ('Ab Wheel Rollout',       'core',      'Equipment',  false),

  -- Cardio
  ('Treadmill Run',          'cardio',    null,         false),
  ('Stationary Bike',        'cardio',    null,         false),
  ('Rowing Machine',         'cardio',    null,         true),
  ('Jump Rope',              'cardio',    null,         false)

ON CONFLICT (name) DO NOTHING;
