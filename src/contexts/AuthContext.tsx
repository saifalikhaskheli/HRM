import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserContext, AppRole, PlatformAdminRole, AuthState } from '@/types/auth';

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<boolean>;
  refreshUserContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track if we're still fetching user context after session is established
  const [isUserContextLoading, setIsUserContextLoading] = useState(false);

  const fetchUserContext = useCallback(async (): Promise<UserContext | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_context');
      if (error) {
        console.error('Error fetching user context:', error);
        return null;
      }
      return data as unknown as UserContext;
    } catch (err) {
      console.error('Error in fetchUserContext:', err);
      return null;
    }
  }, []);

  const refreshUserContext = useCallback(async () => {
    const context = await fetchUserContext();
    setUser(context);
  }, [fetchUserContext]);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        
        if (session?.user) {
          // Mark that we're loading user context
          setIsUserContextLoading(true);
          
          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(async () => {
            if (!mounted) return;
            
            const context = await fetchUserContext();
            if (mounted) {
              setUser(context);
              setIsUserContextLoading(false);
              setIsLoading(false);
            }
            
            // Log login event
            if (event === 'SIGNED_IN') {
              await supabase.from('security_events').insert({
                event_type: 'login_success' as const,
                user_id: session.user.id,
                description: 'User signed in successfully',
                user_agent: navigator.userAgent,
                metadata: {
                  provider: session.user.app_metadata?.provider || 'email',
                  timestamp: new Date().toISOString(),
                },
              });

              // Check for suspicious login (new device/location) - wait for session to be fully established
              setTimeout(async () => {
                try {
                  const { data: { session: currentSession } } = await supabase.auth.getSession();
                  if (currentSession?.access_token) {
                    await supabase.functions.invoke('check-suspicious-login', {
                      body: {
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString(),
                      },
                    });
                  }
                } catch (err) {
                  console.error('Failed to check suspicious login:', err);
                }
              }, 500);
            }
          }, 0);
        } else {
          setUser(null);
          setIsUserContextLoading(false);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      if (session?.user) {
        setIsUserContextLoading(true);
        const context = await fetchUserContext();
        if (mounted) {
          setUser(context);
          setIsUserContextLoading(false);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserContext]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    // Log logout event before signing out
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await supabase.from('security_events').insert({
        event_type: 'login_success' as const,
        user_id: currentUser.id,
        description: 'User signed out',
        user_agent: navigator.userAgent,
        metadata: {
          action: 'logout',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const switchCompany = async (companyId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('set_primary_company', {
        _company_id: companyId,
      });
      
      if (error) {
        console.error('Error switching company:', error);
        return false;
      }
      
      if (data) {
        await refreshUserContext();
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error in switchCompany:', err);
      return false;
    }
  };

  // Combined loading state: loading until BOTH session check AND user context are complete
  const combinedIsLoading = isLoading || isUserContextLoading;

  const value: AuthContextValue = {
    user,
    isLoading: combinedIsLoading,
    isAuthenticated: !!session?.user,
    currentCompanyId: user?.current_company_id || null,
    currentRole: user?.current_role || null,
    isPlatformAdmin: user?.is_platform_admin || false,
    platformAdminRole: user?.platform_admin_role || null,
    signIn,
    signUp,
    signOut,
    switchCompany,
    refreshUserContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
