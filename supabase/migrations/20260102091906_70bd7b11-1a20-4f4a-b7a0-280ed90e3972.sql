-- Create batch user permission setting function for better performance
CREATE OR REPLACE FUNCTION public.set_user_permissions_batch(
  _company_id UUID,
  _target_user_id UUID,
  _permissions JSONB -- Array of {module, action, granted}
) 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  perm JSONB;
  _permission_id UUID;
  _target_role app_role;
BEGIN
  -- Check caller has permission to manage users
  IF NOT public.is_active_company_admin(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized to manage permissions';
  END IF;
  
  -- Get target user's role
  SELECT role INTO _target_role
  FROM public.company_users
  WHERE user_id = _target_user_id
    AND company_id = _company_id
    AND is_active = true;
  
  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found in company';
  END IF;
  
  -- Prevent modifying super_admin permissions
  IF _target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot modify super_admin permissions';
  END IF;
  
  -- Process each permission in the batch
  FOR perm IN SELECT * FROM jsonb_array_elements(_permissions)
  LOOP
    -- Get permission ID
    SELECT id INTO _permission_id
    FROM public.permissions
    WHERE module = (perm->>'module')::permission_module 
      AND action = (perm->>'action')::permission_action;
    
    IF _permission_id IS NOT NULL THEN
      IF (perm->>'granted')::boolean IS NULL THEN
        -- Remove override
        DELETE FROM public.user_permissions
        WHERE company_id = _company_id
          AND user_id = _target_user_id
          AND permission_id = _permission_id;
      ELSE
        -- Set override
        INSERT INTO public.user_permissions (company_id, user_id, permission_id, granted, created_by)
        VALUES (_company_id, _target_user_id, _permission_id, (perm->>'granted')::boolean, auth.uid())
        ON CONFLICT (company_id, user_id, permission_id) 
        DO UPDATE SET granted = (perm->>'granted')::boolean, updated_at = now();
      END IF;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$;