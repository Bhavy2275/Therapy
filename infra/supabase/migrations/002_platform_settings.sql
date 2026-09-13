-- ==============================================================================
-- MIGRATION 002: PLATFORM SETTINGS TABLE
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==============================================================================

-- Key-value store for admin-managed platform configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default values (admin can override via the Admin Portal)
INSERT INTO public.platform_settings (key, value) VALUES
  ('upi_id',          'jarwishelpme@upi'),
  ('upi_name',        'Jarwis Help Me Foundation'),
  ('upi_qr_url',      ''),
  ('donation_note',   'This platform is 100% free. Your voluntary UPI donation helps keep it running and supports therapists who give their time for free.')
ON CONFLICT (key) DO NOTHING;

-- RLS: only admins can write; anyone authenticated can read
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read platform_settings" ON public.platform_settings;
CREATE POLICY "Public read platform_settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write platform_settings" ON public.platform_settings;
CREATE POLICY "Admin write platform_settings"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
