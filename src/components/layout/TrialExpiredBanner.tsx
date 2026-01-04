import { useTenant } from '@/contexts/TenantContext';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

/**
 * Banner shown when trial has expired.
 * This cannot be dismissed - user must upgrade to remove it.
 */
export function TrialExpiredBanner() {
  const { isTrialExpired, isAdmin, planName } = useTenant();

  if (!isTrialExpired) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-destructive/20 via-destructive/10 to-orange-500/20 border-b border-destructive/30">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '16px 16px'
        }} />
      </div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-destructive/20 rounded-full">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">Trial Expired</p>
              <p className="text-sm text-destructive/80">
                Your {planName || ''} trial has ended. Upgrade now to continue using all features. 
                <span className="font-medium"> Your data is safe and will be accessible once you upgrade.</span>
              </p>
            </div>
          </div>
          
          {isAdmin && (
            <Link to="/app/settings/billing">
              <Button 
                size="sm" 
                variant="destructive"
                className="gap-2 shadow-lg shadow-destructive/20"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade Now
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
