-- STEP 1: ADD NEW ENUM VALUES FOR PERMISSIONS
ALTER TYPE public.permission_module ADD VALUE IF NOT EXISTS 'shifts';
ALTER TYPE public.permission_module ADD VALUE IF NOT EXISTS 'attendance';