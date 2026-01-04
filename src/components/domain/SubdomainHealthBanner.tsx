import { AlertTriangle, X, RefreshCw, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubdomainHealth } from '@/hooks/useSubdomainHealth';
import { useDomainCompany } from '@/hooks/useDomainCompany';

export function SubdomainHealthBanner() {
  const { isDomainBased, subdomain, baseDomain } = useDomainCompany();
  const { health, isChecking, isDismissed, checkHealth, dismiss } = useSubdomainHealth();

  // Don't show if not accessing via subdomain
  if (!isDomainBased || !subdomain) {
    return null;
  }

  // Don't show if dismissed or still checking initial state
  if (isDismissed) {
    return null;
  }

  // Don't show if healthy or no health data yet (still loading)
  if (!health || health.isHealthy) {
    return null;
  }

  const fullDomain = `${subdomain}.${baseDomain}`;
  const isPropagating = health.ipMismatch;

  return (
    <div className={`${isPropagating ? 'bg-blue-500/10 border-blue-500/20' : 'bg-amber-500/10 border-amber-500/20'} border-b px-4 py-3`}>
      <div className="flex items-start gap-3 max-w-7xl mx-auto">
        {isPropagating ? (
          <Clock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5 animate-pulse" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        )}
        
        <div className="flex-1 min-w-0">
          {isPropagating ? (
            <>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                DNS Propagation in Progress
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                Your nameserver changes are propagating globally. This typically takes 24-48 hours.
              </p>
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-500">
                <p>
                  <span className="font-mono">{fullDomain}</span> currently resolves to{' '}
                  <span className="font-mono">{health.currentIp}</span> instead of{' '}
                  <span className="font-mono">{health.expectedIp}</span>
                </p>
                <p className="mt-1 text-xs opacity-75">
                  Checked via: {health.checkSource || 'Global DNS'}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Subdomain DNS Configuration Issue
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                <span className="font-mono">{fullDomain}</span> is not properly configured. 
                {health.currentIp && (
                  <span> Currently resolving to <span className="font-mono">{health.currentIp}</span> instead of <span className="font-mono">{health.expectedIp}</span>.</span>
                )}
              </p>
              
              <div className="mt-2 text-sm text-amber-600 dark:text-amber-500">
                <p className="font-medium">To fix this:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Go to your domain registrar's DNS settings for <span className="font-mono">{baseDomain}</span></li>
                  <li>Add or update an A record: <span className="font-mono">*</span> → <span className="font-mono">{health.expectedIp}</span></li>
                  <li>Wait 5-30 minutes for DNS propagation</li>
                </ol>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={checkHealth}
              disabled={isChecking}
              className={`${isPropagating ? 'border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10' : 'border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'}`}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
              Check Again
            </Button>
            <a
              href={`https://dnschecker.org/#A/${fullDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${isPropagating ? 'text-blue-600 dark:text-blue-500' : 'text-amber-600 dark:text-amber-500'} hover:underline inline-flex items-center gap-1`}
            >
              Check global propagation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          className={`${isPropagating ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-500/10' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-500/10'} flex-shrink-0`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
