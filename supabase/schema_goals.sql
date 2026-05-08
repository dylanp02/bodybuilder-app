-- Run in Supabase Dashboard → SQL Editor
-- Creates tables for weight logs, top sets, and body measurements

-- ── Weight Logs ──
CREATE TABLE IF NOT EXISTS weight_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_lbs  DECIMAL(6, 2) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own weight_logs" ON weight_logs
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Top Sets (pre-app personal bests) ──
CREATE TABLE IF NOT EXISTS top_sets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) NOT NULL,
  set_type    TEXT CHECK (set_type IN ('1rm', 'working')) NOT NULL,
  reps        INTEGER,
  weight_lbs  DECIMAL(6, 2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE top_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own top_sets" ON top_sets
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Body Measurements ──
CREATE TABLE IF NOT EXISTS measurements (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  neck_in       DECIMAL(5, 2),
  chest_in      DECIMAL(5, 2),
  shoulders_in  DECIMAL(5, 2),
  biceps_in     DECIMAL(5, 2),
  forearms_in   DECIMAL(5, 2),
  thighs_in     DECIMAL(5, 2),
  calves_in     DECIMAL(5, 2),
  waist_in      DECIMAL(5, 2),
  hips_in       DECIMAL(5, 2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own measurements" ON measurements
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
