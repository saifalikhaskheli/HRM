import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useCurrentCompany } from '@/hooks/useCompany';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_WARNING_MINUTES = 5;

export function SessionTimeoutWarning() {
  const { isAuthenticated } = useAuth();
  const { data: company } = useCurrentCompany();
  
  // Get timeout from company settings or use default
  const settings = company?.settings as Record<string, unknown> | undefined;
  const configuredTimeout = settings?.session_timeout_minutes;
  const timeoutMinutes = typeof configuredTimeout === 'number' 
    ? configuredTimeout 
    : DEFAULT_TIMEOUT_MINUTES;
  
  // If timeout is 0, session timeout is disabled
  const isDisabled = timeoutMinutes === 0;
  
  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout({
    timeoutMinutes: isDisabled ? 9999999 : timeoutMinutes, // Effectively disable if set to 0
    warningMinutes: DEFAULT_WARNING_MINUTES,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't show anything if not authenticated or timeout is disabled
  if (!isAuthenticated || isDisabled) {
    return null;
  }

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Your session is about to expire due to inactivity.
            </p>
            <p className="text-lg font-semibold text-foreground">
              Time remaining: {formatTime(remainingSeconds)}
            </p>
            <p>
              Click the button below to continue your session.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={extendSession}>
            Continue Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
