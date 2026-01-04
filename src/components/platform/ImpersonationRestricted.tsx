import { useTenant } from '@/contexts/TenantContext';
import { Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface ImpersonationRestrictedProps {
  children: React.ReactNode;
  action?: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Wraps content that should be disabled/hidden during impersonation.
 * Shows a visual indicator and disables interaction.
 */
export function ImpersonationRestricted({ 
  children, 
  action = 'This action',
  className,
  showBadge = false,
}: ImpersonationRestrictedProps) {
  const { isImpersonating } = useTenant();

  if (!isImpersonating) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative inline-flex items-center", className)}>
            <div className="opacity-50 pointer-events-none select-none">
              {children}
            </div>
            {showBadge && (
              <Badge 
                variant="outline" 
                className="absolute -top-2 -right-2 bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] px-1 py-0"
              >
                <Lock className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="flex items-start gap-2">
            <Eye className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Read-Only Mode</p>
              <p className="text-xs text-muted-foreground">
                {action} is disabled during impersonation. Exit impersonation to make changes.
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * A small inline badge to indicate read-only mode
 */
export function ReadOnlyBadge({ className }: { className?: string }) {
  const { isImpersonating } = useTenant();

  if (!isImpersonating) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs gap-1",
        className
      )}
    >
      <Eye className="h-3 w-3" />
      Read-Only
    </Badge>
  );
}

/**
 * A banner shown at the top of pages that have restricted actions
 */
export function ReadOnlyPageBanner() {
  const { isImpersonating, companyName } = useTenant();

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
      <div className="bg-amber-500/20 rounded-full p-2">
        <Eye className="h-4 w-4 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Read-Only Mode
        </p>
        <p className="text-xs text-muted-foreground">
          You are viewing {companyName} as a platform admin. Some actions are restricted.
        </p>
      </div>
    </div>
  );
}
