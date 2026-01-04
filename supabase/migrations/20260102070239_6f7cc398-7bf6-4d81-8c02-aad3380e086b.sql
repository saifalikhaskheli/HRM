-- Create a function to reset role permissions to defaults
CREATE OR REPLACE FUNCTION public.reset_role_permissions_to_defaults(
    _company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete all existing role_permissions for this company
    DELETE FROM public.role_permissions WHERE company_id = _company_id;
    
    -- Re-initialize with defaults using the existing function
    PERFORM public.initialize_company_permissions(_company_id);
END;
$$;