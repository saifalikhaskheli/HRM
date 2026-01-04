-- W1: Add RLS policy for managers to view direct reports' documents (read-only)
-- This allows managers to see documents of their direct reports per Workflow 1

CREATE POLICY "employee_documents_select_manager" 
ON public.employee_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.id = employee_documents.employee_id
      AND mgr.user_id = auth.uid()
  )
  AND company_has_module(company_id, 'documents'::text)
);

-- W1: Add RLS policy for managers to view direct reports' expenses (for approval)
CREATE POLICY "expenses_select_manager" 
ON public.expenses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.id = expenses.employee_id
      AND mgr.user_id = auth.uid()
  )
);

-- W1: Add RLS policy for managers to update (approve/reject) direct reports' expenses
CREATE POLICY "expenses_update_manager" 
ON public.expenses 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.id = expenses.employee_id
      AND mgr.user_id = auth.uid()
  )
)
WITH CHECK (
  is_company_active(company_id)
);