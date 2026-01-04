import { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Clock, AlertTriangle, X, Sparkles, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrialExtensionRequestDialog } from '@/components/TrialExtensionRequestDialog';

const DISMISS_KEY = 'trial-banner-dismissed';
const DISMISS_TIMESTAMP_KEY = 'trial-banner-dismissed-at';
const URGENT_RESHOW_HOURS = 1;

export function TrialBanner() {
  const { isTrialing, isTrialExpired, isPastDue, trialDaysRemaining, trialTotalDays, isAdmin, planName } = useTenant();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner should be shown based on session storage
  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    const dismissedAt = sessionStorage.getItem(DISMISS_TIMESTAMP_KEY);
    
    if (dismissed === 'true' && dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      
      // For urgent banners (3 days or less), re-show after 1 hour
      if (trialDaysRemaining !== null && trialDaysRemaining <= 3 && hoursSinceDismiss >= URGENT_RESHOW_HOURS) {
        sessionStorage.removeItem(DISMISS_KEY);
        sessionStorage.removeItem(DISMISS_TIMESTAMP_KEY);
        setIsDismissed(false);
      } else {
        setIsDismissed(true);
      }
    }
  }, [trialDaysRemaining]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, 'true');
    sessionStorage.setItem(DISMISS_TIMESTAMP_KEY, Date.now().toString());
  };

  // Past-due warning takes priority and cannot be dismissed
  if (isPastDue) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 border-b border-destructive/30">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '16px 16px'
          }} />
        </div>
        
        <div className="relative px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 bg-destructive/20 rounded-full">
                <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-destructive">Payment Past Due</p>
                <p className="text-sm text-destructive/80">
                  Please update your billing to avoid service interruption.
                </p>
              </div>
            </div>
            
            {isAdmin && (
              <Link to="/settings/billing">
                <Button 
                  size="sm" 
                  variant="destructive"
                  className="gap-2 shadow-lg shadow-destructive/20"
                >
                  <CreditCard className="h-4 w-4" />
                  Update Billing
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Don't show trial banner if not trialing, trial expired, no days remaining, or dismissed
  // Trial expired has its own banner (TrialExpiredBanner)
  if (!isTrialing || isTrialExpired || trialDaysRemaining === null || isDismissed) return null;

  // Determine urgency level
  const isUrgent = trialDaysRemaining <= 3;
  const isWarning = trialDaysRemaining <= 7 && trialDaysRemaining > 3;
  
  // Calculate progress using actual trial total days (no more hardcoded 14)
  const totalTrialDays = trialTotalDays || 14;
  const daysUsed = totalTrialDays - trialDaysRemaining;
  const progressPercent = Math.min((daysUsed / totalTrialDays) * 100, 100);

  const message = trialDaysRemaining === 0
    ? 'Your trial ends today!'
    : trialDaysRemaining === 1
    ? 'Your trial ends tomorrow!'
    : `${trialDaysRemaining} days left in your ${planName || ''} trial`;

  return (
    <div 
      className={cn(
        "relative overflow-hidden border-b transition-all duration-300",
        isUrgent && "bg-gradient-to-r from-destructive/15 via-destructive/10 to-orange-500/15 border-destructive/30",
        isWarning && "bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15 border-amber-500/30",
        !isUrgent && !isWarning && "bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-primary/20"
      )}
    >
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />
      </div>
      
      {/* Shimmer effect for urgent */}
      {isUrgent && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      )}

      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left side: Icon + Message + Progress */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={cn(
              "flex-shrink-0 p-2 rounded-full",
              isUrgent && "bg-destructive/20",
              isWarning && "bg-amber-500/20",
              !isUrgent && !isWarning && "bg-primary/20"
            )}>
              {isUrgent ? (
                <Clock className="h-5 w-5 text-destructive animate-pulse" />
              ) : (
                <Sparkles className={cn(
                  "h-5 w-5",
                  isWarning ? "text-amber-600" : "text-primary"
                )} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold truncate",
                isUrgent && "text-destructive",
                isWarning && "text-amber-700 dark:text-amber-500",
                !isUrgent && !isWarning && "text-primary"
              )}>
                {message}
              </p>
              
              {/* Progress bar */}
              <div className="mt-1.5 flex items-center gap-2 max-w-xs">
                <div className="flex-1 h-1.5 bg-background/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isUrgent && "bg-destructive",
                      isWarning && "bg-amber-500",
                      !isUrgent && !isWarning && "bg-primary"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {daysUsed}/{totalTrialDays} days
                </span>
              </div>
            </div>
          </div>

          {/* Right side: CTA + Dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (isUrgent || isWarning) && (
              <TrialExtensionRequestDialog />
            )}
            {isAdmin && (
              <Link to="/app/settings/billing">
                <Button 
                  size="sm" 
                  variant={isUrgent ? "destructive" : "default"}
                  className={cn(
                    "gap-2 shadow-md",
                    isUrgent && "shadow-destructive/20",
                    isWarning && "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20",
                    !isUrgent && !isWarning && "shadow-primary/20"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade Now
                </Button>
              </Link>
            )}
            
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
              aria-label="Dismiss trial banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
