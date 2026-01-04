-- Function: Get company ID by slug (for login)
CREATE OR REPLACE FUNCTION public.get_company_id_by_slug(company_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.companies 
  WHERE slug = company_slug 
    AND is_active = true
  LIMIT 1
$$;

-- Function: Get employee login info (returns only user_id and email for login)
CREATE OR REPLACE FUNCTION public.get_employee_login_info(
  p_company_id uuid,
  p_employee_number text
)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT e.user_id, e.email
  FROM public.employees e
  JOIN public.companies c ON c.id = e.company_id
  WHERE e.company_id = p_company_id
    AND e.employee_number = p_employee_number
    AND e.employment_status != 'terminated'
    AND c.is_active = true
  LIMIT 1
$$;

-- Grant access to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_company_id_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_login_info(uuid, text) TO anon, authenticated;