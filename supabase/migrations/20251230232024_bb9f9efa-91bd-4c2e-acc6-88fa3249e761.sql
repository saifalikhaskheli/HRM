-- Add Vercel tracking columns to company_domains table
ALTER TABLE public.company_domains 
ADD COLUMN IF NOT EXISTS vercel_domain_id text,
ADD COLUMN IF NOT EXISTS vercel_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS vercel_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vercel_error text;