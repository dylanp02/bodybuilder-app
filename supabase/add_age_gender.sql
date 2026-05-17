-- Migration: add age and gender columns to profiles
-- Run this in the Supabase dashboard SQL editor (Database → SQL editor → New query)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'prefer_not_to_say'));
