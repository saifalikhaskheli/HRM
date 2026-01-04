-- Allow company admins to view profiles of users in their company
CREATE POLICY "profiles_select_company_admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu_admin
    WHERE cu_admin.user_id = auth.uid()
    AND cu_admin.role IN ('company_admin', 'super_admin')
    AND cu_admin.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.company_users cu_target
      WHERE cu_target.user_id = profiles.id
      AND cu_target.company_id = cu_admin.company_id
    )
  )
);