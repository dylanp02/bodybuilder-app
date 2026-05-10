-- Run in Supabase Dashboard → SQL Editor
-- Allows authenticated users to read and insert exercises

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (true);
