-- Update expense_categories INSERT policy to allow company admins as well
DROP POLICY IF EXISTS expense_categories_insert_hr ON public.expense_categories;

CREATE POLICY "expense_categories_insert_hr_or_admin" 
ON public.expense_categories 
FOR INSERT 
WITH CHECK (
  is_active_company_admin(auth.uid(), company_id) 
  OR (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id))
);