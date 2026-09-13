-- ============================================================
-- seed.sql
-- Therapy Platform — Development Seed Data
--
-- NOTE: This creates users directly in public.users and profiles.
-- For Supabase Auth users, create them via the Supabase dashboard or
-- the auth.users insert below (service role required).
--
-- Run this AFTER both migrations.
-- ============================================================

-- You must run this with the service role key or as postgres user.
-- Replace the UUIDs below if you create real Supabase Auth users
-- and want to use their actual IDs.

DO $$
DECLARE
  admin_id    UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
  therapist_id UUID := 'bbbbbbbb-0000-0000-0000-000000000002';
  client_id   UUID := 'cccccccc-0000-0000-0000-000000000003';
BEGIN

  -- ── Insert into auth.users (requires service role) ─────────────────────────
  -- In Supabase, use the dashboard to create real auth users, then
  -- update these UUIDs to match. This seed inserts directly into
  -- public.users bypassing auth for local Postgres dev only.

  -- Admin
  INSERT INTO public.users (id, email, role, full_name, timezone)
  VALUES (admin_id, 'admin@therapyplatform.dev', 'admin', 'Platform Admin', 'UTC')
  ON CONFLICT (id) DO NOTHING;

  -- Therapist
  INSERT INTO public.users (id, email, role, full_name, timezone)
  VALUES (therapist_id, 'therapist@therapyplatform.dev', 'therapist', 'Dr. Priya Sharma', 'Asia/Kolkata')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.therapist_profiles (
    user_id, bio, license_number, specializations, languages,
    years_of_experience, status, hourly_rate_usd
  ) VALUES (
    therapist_id,
    'Licensed clinical psychologist with 10 years of experience in anxiety, depression, and trauma.',
    'LIC-MH-2024-001',
    ARRAY['anxiety', 'depression', 'trauma', 'couples'],
    ARRAY['English', 'Hindi'],
    10,
    'approved',
    NULL   -- free for now
  ) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.availability_slots (therapist_id, day_of_week, start_time, end_time)
  VALUES
    (therapist_id, 1, '09:00', '17:00'), -- Monday
    (therapist_id, 2, '09:00', '17:00'), -- Tuesday
    (therapist_id, 3, '09:00', '17:00'), -- Wednesday
    (therapist_id, 4, '09:00', '17:00'), -- Thursday
    (therapist_id, 5, '09:00', '13:00')  -- Friday (half day)
  ON CONFLICT DO NOTHING;

  -- Client
  INSERT INTO public.users (id, email, role, full_name, timezone)
  VALUES (client_id, 'client@therapyplatform.dev', 'client', 'Alex Johnson', 'America/New_York')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.client_profiles (user_id, preferred_languages, preferred_therapist_gender)
  VALUES (client_id, ARRAY['English'], 'no_preference')
  ON CONFLICT (user_id) DO NOTHING;

END $$;
