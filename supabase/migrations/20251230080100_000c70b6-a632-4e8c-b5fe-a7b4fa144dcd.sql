-- Create platform_settings table for storing platform-wide configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admins can access settings
CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_settings_insert" ON public.platform_settings
  FOR INSERT WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_settings_update" ON public.platform_settings
  FOR UPDATE USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_settings_delete" ON public.platform_settings
  FOR DELETE USING (public.is_platform_owner(auth.uid()));

-- Add update trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('branding', '{"logo_url": null, "primary_color": "#3b82f6", "platform_name": "HR Platform"}', 'Platform branding settings'),
  ('registration', '{"open_registration": false, "require_invite": true, "allowed_domains": []}', 'User registration settings'),
  ('trial', '{"default_days": 14, "extend_allowed": true, "max_extensions": 2}', 'Trial period settings'),
  ('email', '{"provider": "console", "from_name": "HR Platform", "from_address": "noreply@example.com"}', 'Email configuration')
ON CONFLICT (key) DO NOTHING;