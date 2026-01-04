import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated' | 'suspended';

interface StatusIndicatorProps {
  status: EmployeeStatus;
  variant?: 'badge' | 'dot' | 'bar';
  className?: string;
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<EmployeeStatus, { 
  label: string; 
  dotClass: string; 
  badgeClass: string;
  barClass: string;
}> = {
  active: {
    label: 'Active',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    barClass: 'bg-emerald-500',
  },
  on_leave: {
    label: 'On Leave',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    barClass: 'bg-amber-500',
  },
  terminated: {
    label: 'Terminated',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
    barClass: 'bg-red-500',
  },
  suspended: {
    label: 'Suspended',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
    barClass: 'bg-slate-400',
  },
};

export function StatusIndicator({ status, variant = 'badge', className, showLabel = true }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;

  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className={cn('h-2.5 w-2.5 rounded-full', config.dotClass)} />
        {showLabel && <span className="text-sm font-medium">{config.label}</span>}
      </div>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={cn('h-1 w-full rounded-full', config.barClass, className)} />
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn('font-medium border', config.badgeClass, className)}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', config.dotClass)} />
      {config.label}
    </Badge>
  );
}

export function getStatusBarColor(status: EmployeeStatus): string {
  return STATUS_CONFIG[status]?.barClass || STATUS_CONFIG.active.barClass;
}
