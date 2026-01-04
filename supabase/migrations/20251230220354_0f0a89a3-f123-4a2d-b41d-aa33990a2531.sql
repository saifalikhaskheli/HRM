-- Add hosting_provider column to company_domains table
ALTER TABLE public.company_domains 
ADD COLUMN IF NOT EXISTS hosting_provider text DEFAULT 'vercel' 
CHECK (hosting_provider IN ('lovable', 'vercel'));