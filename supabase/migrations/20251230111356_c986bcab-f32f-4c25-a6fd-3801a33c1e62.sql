-- Update handle_new_user() to complete invitation flow for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invited_company_id UUID;
  _invited_role app_role;
  _invited_by UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Check if user was invited to a company
  BEGIN
    _invited_company_id := (NEW.raw_user_meta_data ->> 'invited_to_company')::UUID;
    _invited_role := COALESCE((NEW.raw_user_meta_data ->> 'invited_role')::app_role, 'employee');
    _invited_by := (NEW.raw_user_meta_data ->> 'invited_by')::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- If parsing fails, skip invitation processing
    _invited_company_id := NULL;
  END;
  
  IF _invited_company_id IS NOT NULL THEN
    -- Add user to the company they were invited to
    INSERT INTO public.company_users (
      company_id,
      user_id,
      role,
      is_primary,
      is_active,
      invited_by,
      invited_at,
      joined_at
    ) VALUES (
      _invited_company_id,
      NEW.id,
      _invited_role,
      true,
      true,
      _invited_by,
      now(),
      now()
    );
    
    -- Log the acceptance in audit logs
    INSERT INTO public.audit_logs (
      company_id,
      user_id,
      action,
      table_name,
      new_values
    ) VALUES (
      _invited_company_id,
      NEW.id,
      'create',
      'company_users',
      jsonb_build_object(
        'event', 'invitation_accepted',
        'role', _invited_role,
        'invited_by', _invited_by
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;