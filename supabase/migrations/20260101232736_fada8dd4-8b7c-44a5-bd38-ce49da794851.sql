-- Add lock action to permission_action enum
ALTER TYPE public.permission_action ADD VALUE IF NOT EXISTS 'lock';