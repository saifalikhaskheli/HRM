import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UseSessionTimeoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onWarning?: () => void;
  onTimeout?: () => void;
}

async function logSessionTimeout(userId: string) {
  try {
    await supabase.from('security_events').insert({
      event_type: 'login_success' as const,
      user_id: userId,
      description: 'Session timed out due to inactivity',
      user_agent: navigator.userAgent,
      metadata: {
        action: 'session_timeout',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Failed to log session timeout:', err);
  }
}

export function useSessionTimeout({
  timeoutMinutes = 30,
  warningMinutes = 5,
  onWarning,
  onTimeout,
}: UseSessionTimeoutOptions = {}) {
  const { isAuthenticated, signOut, user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningMinutes * 60 * 1000;

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleTimeout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    
    // Log the session timeout before signing out
    if (user?.user_id) {
      await logSessionTimeout(user.user_id);
    }
    
    onTimeout?.();
    await signOut();
  }, [clearAllTimers, onTimeout, signOut, user?.user_id]);

  const startCountdown = useCallback(() => {
    const warningSeconds = warningMinutes * 60;
    setRemainingSeconds(warningSeconds);
    
    countdownRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMinutes]);

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    onWarning?.();
    startCountdown();
    
    // Set final timeout
    timeoutRef.current = setTimeout(handleTimeout, warningMs);
  }, [onWarning, startCountdown, handleTimeout, warningMs]);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;
    
    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowWarning(false);
    setRemainingSeconds(0);

    // Set warning timer
    warningRef.current = setTimeout(handleWarning, timeoutMs - warningMs);
  }, [isAuthenticated, clearAllTimers, handleWarning, timeoutMs, warningMs]);

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    let throttleTimer: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      // Throttle activity detection to prevent excessive timer resets
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 1000);

      // Only reset if not showing warning (user must explicitly extend)
      if (!showWarning) {
        resetTimers();
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimers();

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isAuthenticated, resetTimers, clearAllTimers, showWarning]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
  };
}
