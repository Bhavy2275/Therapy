-- ============================================================
-- 003_storage_and_verification.sql
-- Therapy Platform — Therapist Documents Storage & Verification
--
-- Apply in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Run this AFTER 001_initial_schema.sql and 002_rls_policies.sql
-- ============================================================

-- 1. Create a private bucket for therapist verification documents (licenses, certifications)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'therapist-documents',
  'therapist-documents',
  false,
  10485760, -- 10MB maximum file size
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage Policies for therapist-documents bucket

-- Therapists can upload their own documents (path pattern: <user_id>/filename)
CREATE POLICY "Therapists can upload their own verification documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'therapist-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Therapists can read their own verification documents
CREATE POLICY "Therapists can read their own verification documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'therapist-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Therapists can update/replace their own verification documents
CREATE POLICY "Therapists can update their own verification documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'therapist-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all therapist verification documents
CREATE POLICY "Admins can view all therapist verification documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'therapist-documents' AND
    public.current_user_role() = 'admin'
  );

-- 3. Optimization indexes
CREATE INDEX IF NOT EXISTS therapist_profiles_status_idx ON public.therapist_profiles(status);
CREATE INDEX IF NOT EXISTS availability_slots_therapist_idx ON public.availability_slots(therapist_id, day_of_week);
