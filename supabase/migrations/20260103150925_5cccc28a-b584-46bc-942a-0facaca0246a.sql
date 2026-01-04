-- Fix the broken auto_link_user_to_employee trigger function
-- The bug: selecting p.email into a uuid variable (_company_id)

CREATE OR REPLACE FUNCTION public.auto_link_user_to_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email text;
  _company_id uuid;
BEGIN
  -- Get the email from profiles for this user
  SELECT p.email INTO _user_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id;
  
  -- Store the company_id from the trigger row
  _company_id := NEW.company_id;
  
  -- If we found an email, try to link to an employee with matching email
  IF _user_email IS NOT NULL AND _company_id IS NOT NULL THEN
    UPDATE public.employees
    SET user_id = NEW.user_id
    WHERE email = _user_email
      AND company_id = _company_id
      AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;