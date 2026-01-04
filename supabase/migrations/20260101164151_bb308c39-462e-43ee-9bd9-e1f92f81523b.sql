-- Add enable_trial column to company_creation_links table
ALTER TABLE public.company_creation_links 
ADD COLUMN IF NOT EXISTS enable_trial boolean DEFAULT true;