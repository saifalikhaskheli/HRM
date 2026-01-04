import { Card } from '@/components/ui/card';
import { Users, UserCheck, UserMinus, UserPlus, Briefcase, Clock } from 'lucide-react';
import type { Employee } from '@/hooks/useEmployees';
import { useMemo } from 'react';

interface EmployeeStatsBarProps {
  employees: Employee[];
  isLoading?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

function StatCard({ icon, label, value, trend, className }: StatCardProps) {
  return (
    <Card className={`flex items-center gap-3 p-4 border-border/50 ${className || ''}`}>
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">{value}</span>
          {trend && (
            <span className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function EmployeeStatsBar({ employees, isLoading }: EmployeeStatsBarProps) {
  const stats = useMemo(() => {
    if (!employees || employees.length === 0) {
      return {
        total: 0,
        active: 0,
        onLeave: 0,
        fullTime: 0,
        partTime: 0,
        newThisMonth: 0,
      };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: employees.length,
      active: employees.filter(e => e.employment_status === 'active').length,
      onLeave: employees.filter(e => e.employment_status === 'on_leave').length,
      fullTime: employees.filter(e => e.employment_type === 'full_time').length,
      partTime: employees.filter(e => e.employment_type === 'part_time' || e.employment_type === 'contract').length,
      newThisMonth: employees.filter(e => new Date(e.hire_date) >= startOfMonth).length,
    };
  }, [employees]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="h-[76px] animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Total"
        value={stats.total}
      />
      <StatCard
        icon={<UserCheck className="h-5 w-5" />}
        label="Active"
        value={stats.active}
      />
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label="On Leave"
        value={stats.onLeave}
      />
      <StatCard
        icon={<Briefcase className="h-5 w-5" />}
        label="Full-Time"
        value={stats.fullTime}
      />
      <StatCard
        icon={<UserMinus className="h-5 w-5" />}
        label="Part-Time/Contract"
        value={stats.partTime}
      />
      <StatCard
        icon={<UserPlus className="h-5 w-5" />}
        label="New This Month"
        value={stats.newThisMonth}
        trend={stats.newThisMonth > 0 ? { value: stats.newThisMonth, isPositive: true } : undefined}
      />
    </div>
  );
}
