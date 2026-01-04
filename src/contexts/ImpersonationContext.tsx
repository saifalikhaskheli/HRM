import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface ImpersonatedCompany {
  id: string;
  name: string;
  slug: string;
}

interface ImpersonationContextValue {
  isImpersonating: boolean;
  impersonatedCompany: ImpersonatedCompany | null;
  startImpersonation: (company: ImpersonatedCompany) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  effectiveCompanyId: string | null;
  impersonationStartedAt: Date | null;
}

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPlatformAdmin, currentCompanyId } = useAuth();
  const [impersonatedCompany, setImpersonatedCompany] = useState<ImpersonatedCompany | null>(null);
  const [impersonationStartedAt, setImpersonationStartedAt] = useState<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  // Clear impersonation state on auth changes (logout, user switch)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUserId = session?.user?.id || null;
        
        // Clear impersonation if:
        // 1. User signed out
        // 2. User changed (different user logged in)
        // 3. No session exists
        if (
          event === 'SIGNED_OUT' ||
          !session ||
          (previousUserIdRef.current && previousUserIdRef.current !== currentUserId)
        ) {
          sessionIdRef.current = null;
          setImpersonatedCompany(null);
          setImpersonationStartedAt(null);
        }
        
        previousUserIdRef.current = currentUserId;
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Also clear if user loses platform admin status
  useEffect(() => {
    if (impersonatedCompany && !isPlatformAdmin) {
      sessionIdRef.current = null;
      setImpersonatedCompany(null);
      setImpersonationStartedAt(null);
    }
  }, [isPlatformAdmin, impersonatedCompany]);

  const startImpersonation = useCallback(async (company: ImpersonatedCompany) => {
    if (!isPlatformAdmin) {
      toast.error('Only platform admins can impersonate companies');
      return;
    }

    // Get the actual auth user ID directly from Supabase
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      toast.error('Authentication required');
      return;
    }

    // Generate a session ID for this impersonation
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;

    // Log impersonation start to dedicated table
    try {
      const { error: logError } = await supabase.from('impersonation_logs').insert({
        admin_user_id: authUser.id,
        company_id: company.id,
        company_name: company.name,
        action: 'start',
        session_id: sessionId,
        user_agent: navigator.userAgent,
        metadata: {
          company_slug: company.slug,
        },
      });

      if (logError) {
        console.error('Failed to log impersonation start:', logError);
      }
    } catch (err) {
      console.error('Failed to log impersonation start:', err);
    }

    setImpersonatedCompany(company);
    setImpersonationStartedAt(new Date());
    toast.success(`Now viewing as ${company.name}`);
  }, [isPlatformAdmin]);

  const stopImpersonation = useCallback(async () => {
    if (impersonatedCompany) {
      // Get the actual auth user ID directly from Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // Log impersonation end
      if (authUser) {
        try {
          const { error: logError } = await supabase.from('impersonation_logs').insert({
            admin_user_id: authUser.id,
            company_id: impersonatedCompany.id,
            company_name: impersonatedCompany.name,
            action: 'end',
            session_id: sessionIdRef.current,
            user_agent: navigator.userAgent,
            metadata: {
              company_slug: impersonatedCompany.slug,
              duration_seconds: impersonationStartedAt 
                ? Math.floor((Date.now() - impersonationStartedAt.getTime()) / 1000) 
                : null,
            },
          });

          if (logError) {
            console.error('Failed to log impersonation end:', logError);
          }
        } catch (err) {
          console.error('Failed to log impersonation end:', err);
        }
      }
    }

    sessionIdRef.current = null;
    setImpersonatedCompany(null);
    setImpersonationStartedAt(null);
    toast.info('Impersonation ended');
  }, [impersonatedCompany, impersonationStartedAt]);

  // The effective company ID is the impersonated company if impersonating,
  // otherwise the user's actual current company
  const effectiveCompanyId = impersonatedCompany?.id || currentCompanyId;

  const value: ImpersonationContextValue = {
    isImpersonating: !!impersonatedCompany,
    impersonatedCompany,
    startImpersonation,
    stopImpersonation,
    effectiveCompanyId,
    impersonationStartedAt,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};