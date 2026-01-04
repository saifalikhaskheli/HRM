-- Fix the audit_permission_change function - remove ::text cast from id fields
CREATE OR REPLACE FUNCTION public.audit_permission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            new_values
        ) VALUES (
            NEW.company_id,
            auth.uid(),
            'create',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        ) VALUES (
            NEW.company_id,
            auth.uid(),
            'update',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values
        ) VALUES (
            OLD.company_id,
            auth.uid(),
            'delete',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

-- Create function to auto-initialize permissions for new companies
CREATE OR REPLACE FUNCTION public.auto_initialize_company_permissions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.initialize_company_permissions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger to auto-initialize permissions when a company is created
DROP TRIGGER IF EXISTS trigger_auto_init_permissions ON public.companies;
CREATE TRIGGER trigger_auto_init_permissions
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.auto_initialize_company_permissions();

-- Initialize permissions for all existing active companies that don't have permissions yet
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT id FROM public.companies 
    WHERE is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.company_id = companies.id
    )
  LOOP
    PERFORM public.initialize_company_permissions(company_record.id);
  END LOOP;
END $$;