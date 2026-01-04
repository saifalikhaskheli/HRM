import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDomainCompany } from './useDomainCompany';

interface SubdomainHealthResult {
  isHealthy: boolean;
  subdomain: string;
  currentIp: string | null;
  expectedIp: string;
  messages: string[];
  checkedAt: string;
  ipMismatch?: boolean;
  checkSource?: string;
  propagationStatus?: 'complete' | 'partial' | 'pending';
}

interface UseSubdomainHealthResult {
  health: SubdomainHealthResult | null;
  isChecking: boolean;
  isDismissed: boolean;
  checkHealth: () => Promise<void>;
  dismiss: () => void;
}

const CACHE_KEY = 'subdomain_health_cache';
const DISMISS_KEY = 'subdomain_health_dismissed';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export function useSubdomainHealth(): UseSubdomainHealthResult {
  const { subdomain, baseDomain, isDomainBased } = useDomainCompany();
  const [health, setHealth] = useState<SubdomainHealthResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if dismissed
  useEffect(() => {
    if (!subdomain) return;
    
    const dismissedData = localStorage.getItem(`${DISMISS_KEY}_${subdomain}`);
    if (dismissedData) {
      try {
        const { dismissedAt } = JSON.parse(dismissedData);
        // Dismiss lasts for 24 hours
        if (Date.now() - new Date(dismissedAt).getTime() < 24 * 60 * 60 * 1000) {
          setIsDismissed(true);
        } else {
          localStorage.removeItem(`${DISMISS_KEY}_${subdomain}`);
        }
      } catch {
        localStorage.removeItem(`${DISMISS_KEY}_${subdomain}`);
      }
    }
  }, [subdomain]);

  const checkHealth = useCallback(async () => {
    if (!subdomain || !baseDomain) return;

    // Check cache first
    const cacheKey = `${CACHE_KEY}_${subdomain}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { result, cachedAt } = JSON.parse(cachedData);
        if (Date.now() - new Date(cachedAt).getTime() < CACHE_DURATION_MS) {
          setHealth(result);
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    setIsChecking(true);

    try {
      const fullDomain = `${subdomain}.${baseDomain}`;
      
      const { data, error } = await supabase.functions.invoke('check-domain-health', {
        body: { 
          domain: fullDomain,
          hostingProvider: 'vercel'
        }
      });

      if (error) throw error;

      const result: SubdomainHealthResult = {
        isHealthy: data.isHealthy,
        subdomain,
        currentIp: data.rootIp,
        expectedIp: data.expectedIp || '76.76.21.21',
        messages: data.messages || [],
        checkedAt: new Date().toISOString(),
        ipMismatch: data.ipMismatch,
        checkSource: data.checkSource,
        propagationStatus: data.propagationStatus,
      };

      setHealth(result);

      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        result,
        cachedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[useSubdomainHealth] Error checking health:', error);
    } finally {
      setIsChecking(false);
    }
  }, [subdomain, baseDomain]);

  // Auto-check on mount if accessing via subdomain
  useEffect(() => {
    if (isDomainBased && subdomain && !isDismissed) {
      checkHealth();
    }
  }, [isDomainBased, subdomain, isDismissed, checkHealth]);

  const dismiss = useCallback(() => {
    if (!subdomain) return;
    
    localStorage.setItem(`${DISMISS_KEY}_${subdomain}`, JSON.stringify({
      dismissedAt: new Date().toISOString(),
    }));
    setIsDismissed(true);
  }, [subdomain]);

  return {
    health,
    isChecking,
    isDismissed,
    checkHealth,
    dismiss,
  };
}
