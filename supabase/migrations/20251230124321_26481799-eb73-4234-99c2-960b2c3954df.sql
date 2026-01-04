-- Create company_email_settings table for company-specific email configurations
CREATE TABLE public.company_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Configuration mode
  use_platform_default BOOLEAN NOT NULL DEFAULT true,
  
  -- Provider type
  provider TEXT CHECK (provider IN ('smtp', 'mailersend', 'sendgrid', 'ses', 'resend')),
  
  -- From address configuration
  from_email TEXT,
  from_name TEXT,
  
  -- SMTP Settings
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  
  -- API Settings (for MailerSend/SendGrid/Resend)
  api_key TEXT,
  
  -- AWS SES Settings
  aws_region TEXT,
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  
  -- Verification status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_test_at TIMESTAMPTZ,
  last_test_result JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_email_settings ENABLE ROW LEVEL SECURITY;

-- Company admins can manage their own settings
CREATE POLICY "company_email_settings_select_admin"
  ON public.company_email_settings FOR SELECT
  USING (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_email_settings_insert_admin"
  ON public.company_email_settings FOR INSERT
  WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_email_settings_update_admin"
  ON public.company_email_settings FOR UPDATE
  USING (is_active_company_admin(auth.uid(), company_id))
  WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_email_settings_delete_admin"
  ON public.company_email_settings FOR DELETE
  USING (is_active_company_admin(auth.uid(), company_id));

-- Platform admins can view all settings
CREATE POLICY "company_email_settings_select_platform_admin"
  ON public.company_email_settings FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_company_email_settings_company_id ON public.company_email_settings(company_id);

-- Add update trigger
CREATE TRIGGER update_company_email_settings_updated_at
  BEFORE UPDATE ON public.company_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();