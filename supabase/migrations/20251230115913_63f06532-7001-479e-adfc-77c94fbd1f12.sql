-- Add force_password_change flag to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;

-- Add login_type to track how users should authenticate (email for admins, employee_id for employees)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_type text DEFAULT 'email' CHECK (login_type IN ('email', 'employee_id'));