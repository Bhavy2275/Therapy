-- ============================================================
-- 002_rls_policies.sql
-- Therapy Platform — Row Level Security Policies
--
-- Apply AFTER 001_initial_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations          ENABLE ROW LEVEL SECURITY;

-- ─── Helper: current user's role ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── users ───────────────────────────────────────────────────────────────────

-- Users can read their own row; admins can read all
CREATE POLICY "users: read own or admin reads all"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR public.current_user_role() = 'admin'
  );

-- Users can update their own row (except role — cannot self-promote)
CREATE POLICY "users: update own non-sensitive fields"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid()) -- role unchanged
  );

-- Therapist profiles are publicly readable (for client browsing)
CREATE POLICY "therapist_profiles: public read approved"
  ON public.therapist_profiles FOR SELECT
  USING (
    status = 'approved'
    OR user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

-- Therapist can update their own profile (not status — admin only)
CREATE POLICY "therapist_profiles: therapist updates own"
  ON public.therapist_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status = (SELECT status FROM public.therapist_profiles WHERE user_id = auth.uid())
  );

-- Admin can update any therapist profile (including status)
CREATE POLICY "therapist_profiles: admin full update"
  ON public.therapist_profiles FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- ─── client_profiles ─────────────────────────────────────────────────────────

CREATE POLICY "client_profiles: read own or admin"
  ON public.client_profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "client_profiles: update own"
  ON public.client_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── availability_slots ──────────────────────────────────────────────────────

-- Anyone (including unauthenticated) can read availability for scheduling UI
CREATE POLICY "availability_slots: public read"
  ON public.availability_slots FOR SELECT
  USING (true);

CREATE POLICY "availability_slots: therapist manages own"
  ON public.availability_slots FOR ALL
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "availability_slots: admin reads all"
  ON public.availability_slots FOR SELECT
  USING (public.current_user_role() = 'admin');

-- ─── sessions ────────────────────────────────────────────────────────────────

-- Client sees their own sessions; therapist sees sessions assigned to them; admin sees all
CREATE POLICY "sessions: participant or admin can read"
  ON public.sessions FOR SELECT
  USING (
    client_id = auth.uid()
    OR therapist_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

-- Client can create a session for themselves
CREATE POLICY "sessions: client can insert"
  ON public.sessions FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND public.current_user_role() = 'client'
  );

-- Participants can update sessions they're part of; admin can update all
CREATE POLICY "sessions: participant or admin can update"
  ON public.sessions FOR UPDATE
  USING (
    client_id = auth.uid()
    OR therapist_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

-- ─── donations ───────────────────────────────────────────────────────────────

-- Donors see their own; admin sees all
CREATE POLICY "donations: donor or admin can read"
  ON public.donations FOR SELECT
  USING (
    donor_user_id = auth.uid()
    OR donor_user_id IS NULL -- anonymous donations only visible to admin below
    OR public.current_user_role() = 'admin'
  );

-- Authenticated users can create a donation
CREATE POLICY "donations: authenticated can insert"
  ON public.donations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (donor_user_id = auth.uid() OR donor_user_id IS NULL)
  );
