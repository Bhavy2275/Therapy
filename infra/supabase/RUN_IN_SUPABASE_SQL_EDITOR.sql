-- ==============================================================================
-- MIND-BRIDGE — COMPLETE DATABASE SETUP SCRIPT
-- Copy this entire file and paste it into:
-- Supabase Dashboard -> SQL Editor -> New query -> Click "Run" (green button)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'therapist', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE therapist_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'timed_out', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_type AS ENUM ('voice', 'video', 'chat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_mode AS ENUM ('instant', 'scheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'client',
  full_name     TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. THERAPIST PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.therapist_profiles (
  user_id               UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  bio                   TEXT NOT NULL DEFAULT '',
  license_number        TEXT NOT NULL DEFAULT '',
  license_document_url  TEXT,
  specializations       TEXT[] NOT NULL DEFAULT '{}',
  languages             TEXT[] NOT NULL DEFAULT '{English}',
  years_of_experience   SMALLINT NOT NULL DEFAULT 0,
  status                therapist_status NOT NULL DEFAULT 'pending',
  admin_note            TEXT,
  is_available_now      BOOLEAN NOT NULL DEFAULT FALSE,
  hourly_rate_usd       NUMERIC(8, 2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS therapist_profiles_updated_at ON public.therapist_profiles;
CREATE TRIGGER therapist_profiles_updated_at
  BEFORE UPDATE ON public.therapist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS therapist_profiles_status_idx ON public.therapist_profiles(status);

-- 6. CLIENT PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.client_profiles (
  user_id                    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  preferred_languages        TEXT[] NOT NULL DEFAULT '{English}',
  preferred_therapist_gender TEXT CHECK (preferred_therapist_gender IN ('male','female','no_preference'))
                             DEFAULT 'no_preference',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS client_profiles_updated_at ON public.client_profiles;
CREATE TRIGGER client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. AVAILABILITY SLOTS TABLE
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  CONSTRAINT end_after_start CHECK (end_time > start_time),
  UNIQUE (therapist_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS availability_slots_therapist_idx ON public.availability_slots(therapist_id, day_of_week);

-- 8. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id                UUID NOT NULL REFERENCES public.users(id),
  therapist_id             UUID REFERENCES public.users(id),
  type                     session_type NOT NULL,
  mode                     session_mode NOT NULL DEFAULT 'instant',
  status                   session_status NOT NULL DEFAULT 'pending',
  scheduled_at             TIMESTAMPTZ,
  started_at               TIMESTAMPTZ,
  ended_at                 TIMESTAMPTZ,
  duration_minutes         SMALLINT,
  livekit_room_name        TEXT UNIQUE,
  notes                    TEXT,
  billing_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  rate_usd_at_time         NUMERIC(8, 2),
  charged_amount_cents     INTEGER,
  stripe_payment_intent_id TEXT UNIQUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_client_idx      ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS sessions_therapist_idx   ON public.sessions(therapist_id);
CREATE INDEX IF NOT EXISTS sessions_status_idx      ON public.sessions(status);
CREATE INDEX IF NOT EXISTS sessions_scheduled_idx   ON public.sessions(scheduled_at) WHERE scheduled_at IS NOT NULL;

DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. DONATIONS TABLE (Phase 6)
CREATE TABLE IF NOT EXISTS public.donations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  status                   TEXT NOT NULL DEFAULT 'pending',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. AUTH TRIGGER (Automatically inserts public.users and role profile on signup)
-- Hardened with SECURITY DEFINER, explicit search_path, safe enum resolution, and catch-all exception safety
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _raw_role TEXT;
  _role public.user_role;
  _full_name TEXT;
  _tz TEXT;
BEGIN
  -- Extract raw role safely without throwing on invalid cast
  _raw_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF _raw_role = 'therapist' THEN
    _role := 'therapist'::public.user_role;
  ELSIF _raw_role = 'admin' THEN
    _role := 'admin'::public.user_role;
  ELSE
    _role := 'client'::public.user_role;
  END IF;

  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _tz := COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC');

  -- Delete any orphaned record with the same email if user ID differs to prevent unique violation
  DELETE FROM public.users WHERE email = NEW.email AND id <> NEW.id;

  -- Upsert public user
  INSERT INTO public.users (id, email, role, full_name, timezone)
  VALUES (NEW.id, NEW.email, _role, _full_name, _tz)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = CASE WHEN public.users.full_name = '' THEN EXCLUDED.full_name ELSE public.users.full_name END,
    timezone = EXCLUDED.timezone;

  -- Insert profile stub based on role
  IF _role = 'therapist' THEN
    INSERT INTO public.therapist_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role = 'client' THEN
    INSERT INTO public.client_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort auth.users insert transaction on trigger error
  RAISE WARNING 'handle_new_user error for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. PERMISSIONS
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 12. ROW LEVEL SECURITY (RLS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Users RLS
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record" ON public.users FOR SELECT USING (id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Enable insert for all on users" ON public.users;
CREATE POLICY "Enable insert for all on users" ON public.users FOR INSERT WITH CHECK (true);

-- Therapist Profiles RLS
DROP POLICY IF EXISTS "Anyone can view approved therapist profiles" ON public.therapist_profiles;
CREATE POLICY "Anyone can view approved therapist profiles" ON public.therapist_profiles FOR SELECT USING (status = 'approved' OR user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Therapists can update own profile" ON public.therapist_profiles;
CREATE POLICY "Therapists can update own profile" ON public.therapist_profiles FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Enable insert for therapist profiles" ON public.therapist_profiles;
CREATE POLICY "Enable insert for therapist profiles" ON public.therapist_profiles FOR INSERT WITH CHECK (true);

-- Client Profiles RLS
DROP POLICY IF EXISTS "Clients read/update own profile" ON public.client_profiles;
CREATE POLICY "Clients read/update own profile" ON public.client_profiles FOR ALL USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Enable insert for client profiles" ON public.client_profiles;
CREATE POLICY "Enable insert for client profiles" ON public.client_profiles FOR INSERT WITH CHECK (true);

-- Availability Slots RLS
DROP POLICY IF EXISTS "Anyone can view availability" ON public.availability_slots;
CREATE POLICY "Anyone can view availability" ON public.availability_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Therapists manage own slots" ON public.availability_slots;
CREATE POLICY "Therapists manage own slots" ON public.availability_slots FOR ALL USING (therapist_id = auth.uid() OR public.current_user_role() = 'admin');

-- Sessions RLS
DROP POLICY IF EXISTS "Participants can view own sessions" ON public.sessions;
CREATE POLICY "Participants can view own sessions" ON public.sessions FOR SELECT USING (client_id = auth.uid() OR therapist_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Clients can create sessions" ON public.sessions;
CREATE POLICY "Clients can create sessions" ON public.sessions FOR INSERT WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update own sessions" ON public.sessions;
CREATE POLICY "Participants can update own sessions" ON public.sessions FOR UPDATE USING (client_id = auth.uid() OR therapist_id = auth.uid() OR public.current_user_role() = 'admin');

-- Donations RLS
DROP POLICY IF EXISTS "Users can read own donations" ON public.donations;
CREATE POLICY "Users can read own donations" ON public.donations FOR SELECT USING (donor_user_id = auth.uid() OR public.current_user_role() = 'admin');

-- 13. STORAGE POLICIES
DROP POLICY IF EXISTS "Therapists can upload their own verification documents" ON storage.objects;
CREATE POLICY "Therapists can upload their own verification documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'therapist-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Therapists can read their own verification documents" ON storage.objects;
CREATE POLICY "Therapists can read their own verification documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'therapist-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view all therapist verification documents" ON storage.objects;
CREATE POLICY "Admins can view all therapist verification documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'therapist-documents' AND public.current_user_role() = 'admin');

-- 14. BACKFILL EXISTING SIGNED-UP USERS (e.g. bhav30402@gmail.com)
INSERT INTO public.users (id, email, role, full_name, timezone)
SELECT
  id,
  email,
  CASE
    WHEN raw_user_meta_data->>'role' = 'therapist' THEN 'therapist'::public.user_role
    WHEN raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
    ELSE 'client'::public.user_role
  END,
  COALESCE(raw_user_meta_data->>'full_name', 'User'),
  COALESCE(raw_user_meta_data->>'timezone', 'Asia/Calcutta')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.client_profiles (user_id)
SELECT id FROM public.users WHERE role = 'client'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.therapist_profiles (user_id)
SELECT id FROM public.users WHERE role = 'therapist'
ON CONFLICT (user_id) DO NOTHING;

-- Done!
SELECT 'Database schema successfully configured!' AS result;

