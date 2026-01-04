-- Allow 'brevo' in company_email_settings provider constraint
ALTER TABLE public.company_email_settings
  DROP CONSTRAINT IF EXISTS company_email_settings_provider_check;

ALTER TABLE public.company_email_settings
  ADD CONSTRAINT company_email_settings_provider_check
  CHECK (
    provider IS NULL OR provider = ANY (ARRAY[
      'smtp'::text,
      'mailersend'::text,
      'sendgrid'::text,
      'ses'::text,
      'resend'::text,
      'brevo'::text
    ])
  );