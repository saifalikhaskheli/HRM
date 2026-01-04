import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { CalendarDays, Info } from 'lucide-react';
import type { LeaveBalance } from '@/hooks/useLeaveBalances';

interface LeaveBalanceCardProps {
  balances: LeaveBalance[] | undefined;
  isLoading?: boolean;
  compact?: boolean;
  title?: string;
}

export function LeaveBalanceCard({ balances, isLoading, compact = false, title = 'Leave Balances' }: LeaveBalanceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!balances?.length) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className={compact ? 'text-base' : ''}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No leave types configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className={compact ? 'text-base flex items-center gap-2' : 'flex items-center gap-2'}>
          <CalendarDays className="h-4 w-4" />
          {title}
        </CardTitle>
        {!compact && (
          <CardDescription>Your remaining leave days for {new Date().getFullYear()}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className={compact ? 'space-y-3' : 'space-y-4'}>
            {balances.map((balance) => {
              const totalAllocated = balance.allocated + (balance.carriedOver || 0) + (balance.adjustments || 0);
              const percentage = totalAllocated > 0 
                ? Math.round((balance.used / totalAllocated) * 100) 
                : 0;
              const isLow = balance.remaining <= 2 && totalAllocated > 0;
              const isExhausted = balance.remaining <= 0 && totalAllocated > 0;
              const hasExtra = (balance.carriedOver || 0) > 0 || (balance.adjustments || 0) !== 0;

              return (
                <div key={balance.leaveTypeId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        style={{ backgroundColor: balance.color || undefined }}
                        className="text-xs"
                      >
                        {balance.leaveTypeName}
                      </Badge>
                      {balance.pending > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({balance.pending} pending)
                        </span>
                      )}
                      {hasExtra && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <p>Base allocation: {balance.allocated} days</p>
                              {(balance.carriedOver || 0) > 0 && (
                                <p>Carried over: +{balance.carriedOver} days</p>
                              )}
                              {(balance.adjustments || 0) !== 0 && (
                                <p>Adjustments: {balance.adjustments > 0 ? '+' : ''}{balance.adjustments} days</p>
                              )}
                              <p className="font-medium">Total: {totalAllocated} days</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className={isExhausted ? 'text-destructive font-medium' : isLow ? 'text-yellow-600 font-medium' : 'font-medium'}>
                        {balance.remaining}
                      </span>
                      <span className="text-muted-foreground"> / {totalAllocated}</span>
                    </div>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-1.5 ${isExhausted ? '[&>div]:bg-destructive' : isLow ? '[&>div]:bg-yellow-500' : ''}`}
                  />
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
