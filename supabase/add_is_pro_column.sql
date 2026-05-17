-- Run this in Supabase SQL Editor before deploying the revenuecat-webhook function.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
