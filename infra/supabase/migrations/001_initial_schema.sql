-- ============================================================
-- 001_initial_schema.sql
-- Therapy Platform — Initial Database Schema
--
-- Apply in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Run this BEFORE 002_rls_policies.sql
-- ============================================================

-- Enable UUID extension (already enabled in Supabase, included for safety)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('client', 'therapist', 'admin');

CREATE TYPE therapist_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'suspended'
);

CREATE TYPE session_status AS ENUM (
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'timed_out',
  'no_show'
);

CREATE TYPE session_type AS ENUM ('voice', 'video', 'chat');

CREATE TYPE session_mode AS ENUM ('instant', 'scheduled');

-- ─── users ───────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-level fields.
-- Populated automatically via trigger on auth.users insert.

CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'client',
  full_name     TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── therapist_profiles ──────────────────────────────────────────────────────

CREATE TABLE public.therapist_profiles (
  user_id               UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  bio                   TEXT NOT NULL DEFAULT '',
  license_number        TEXT NOT NULL DEFAULT '',
  license_document_url  TEXT,                        -- Supabase Storage object URL
  specializations       TEXT[] NOT NULL DEFAULT '{}',
  languages             TEXT[] NOT NULL DEFAULT '{English}',
  years_of_experience   SMALLINT NOT NULL DEFAULT 0,
  status                therapist_status NOT NULL DEFAULT 'pending',
  admin_note            TEXT,
  is_available_now      BOOLEAN NOT NULL DEFAULT FALSE, -- managed by matching service
  hourly_rate_usd       NUMERIC(8, 2),                -- null = not set; for future billing
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER therapist_profiles_updated_at
  BEFORE UPDATE ON public.therapist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── client_profiles ─────────────────────────────────────────────────────────

CREATE TABLE public.client_profiles (
  user_id                    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  preferred_languages        TEXT[] NOT NULL DEFAULT '{English}',
  preferred_therapist_gender TEXT CHECK (preferred_therapist_gender IN ('male','female','no_preference'))
                             DEFAULT 'no_preference',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── availability_slots ──────────────────────────────────────────────────────
-- Recurring weekly availability for scheduled bookings (Phase 5).

CREATE TABLE public.availability_slots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time     TIME NOT NULL,   -- therapist's local timezone (stored as UTC-naive TIME)
  end_time       TIME NOT NULL,
  CONSTRAINT end_after_start CHECK (end_time > start_time),
  UNIQUE (therapist_id, day_of_week, start_time)
);

-- ─── sessions ────────────────────────────────────────────────────────────────
-- Core booking/session record. Designed to support future billing without rework.

CREATE TABLE public.sessions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id                UUID NOT NULL REFERENCES public.users(id),
  therapist_id             UUID REFERENCES public.users(id),  -- null until matched
  type                     session_type NOT NULL,
  mode                     session_mode NOT NULL DEFAULT 'instant',
  status                   session_status NOT NULL DEFAULT 'pending',
  scheduled_at             TIMESTAMPTZ,                        -- null for instant sessions
  started_at               TIMESTAMPTZ,
  ended_at                 TIMESTAMPTZ,
  duration_minutes         SMALLINT,                          -- computed on session end
  livekit_room_name        TEXT UNIQUE,                       -- set when accepted
  notes                    TEXT,                              -- therapist post-session notes

  -- ── Future billing (Phase 6+) ─────────────────────────────────────────────
  billing_enabled          BOOLEAN NOT NULL DEFAULT FALSE,    -- false = free/donation era
  rate_usd_at_time         NUMERIC(8, 2),                     -- snapshot of therapist rate
  charged_amount_cents     INTEGER,                           -- null until charged
  stripe_payment_intent_id TEXT UNIQUE,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_client_idx      ON public.sessions(client_id);
CREATE INDEX sessions_therapist_idx   ON public.sessions(therapist_id);
CREATE INDEX sessions_status_idx      ON public.sessions(status);
CREATE INDEX sessions_scheduled_idx   ON public.sessions(scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── donations ───────────────────────────────────────────────────────────────
-- Phase 6 — one-time optional platform donations (NOT session-linked).

CREATE TABLE public.donations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL, -- null = anonymous
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  status                   TEXT NOT NULL DEFAULT 'pending', -- pending | succeeded | failed
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auto-create user profile row on Supabase Auth signup ────────────────────
-- This trigger fires when a new row is inserted into auth.users.
-- The role and full_name are passed via raw_user_meta_data from the client.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role;
  _full_name TEXT;
BEGIN
  -- Default to 'client' if role not provided or invalid
  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    _role := 'client';
  END;

  IF _role IS NULL THEN
    _role := 'client';
  END IF;

  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Insert into public.users
  INSERT INTO public.users (id, email, role, full_name, timezone)
  VALUES (
    NEW.id,
    NEW.email,
    _role,
    _full_name,
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  );

  -- Create role-specific profile stub
  IF _role = 'therapist' THEN
    INSERT INTO public.therapist_profiles (user_id) VALUES (NEW.id);
  ELSIF _role = 'client' THEN
    INSERT INTO public.client_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
