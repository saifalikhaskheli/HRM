import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertTriangle } from 'lucide-react';

export function EmployeeUsageCard() {
  const { companyId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['employee-usage', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Get active employee count
      const { count: employeeCount, error: countError } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated');

      if (countError) throw countError;

      // Get plan limit
      const { data: subscription, error: subError } = await supabase
        .from('company_subscriptions')
        .select(`
          plan_id,
          plans (
            max_employees,
            name
          )
        `)
        .eq('company_id', companyId)
        .maybeSingle();

      if (subError) throw subError;

      const maxEmployees = (subscription?.plans as { max_employees: number | null; name: string } | null)?.max_employees;
      const planName = (subscription?.plans as { max_employees: number | null; name: string } | null)?.name || 'Free';

      return {
        used: employeeCount || 0,
        limit: maxEmployees,
        planName,
      };
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isUnlimited = !data.limit || data.limit >= 9999;
  const percentage = isUnlimited ? 0 : Math.round((data.used / data.limit!) * 100);
  const isWarning = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && data.used >= data.limit!;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee Usage
          </CardTitle>
          <CardDescription>{data.planName} Plan</CardDescription>
        </div>
        {isWarning && !isAtLimit && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {percentage}% used
          </Badge>
        )}
        {isAtLimit && (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            At limit
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{data.used}</span>
          <span className="text-sm text-muted-foreground">
            / {isUnlimited ? '∞' : data.limit} employees
          </span>
        </div>
        {!isUnlimited && (
          <Progress 
            value={percentage} 
            className={isAtLimit ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''}
          />
        )}
        {isAtLimit && (
          <p className="text-xs text-destructive">
            You've reached your employee limit. Upgrade your plan to add more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
