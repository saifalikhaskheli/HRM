import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  LogIn, 
  LogOut, 
  Key, 
  Smartphone, 
  AlertTriangle, 
  Ban, 
  Download,
  RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type SecurityEventType = Database['public']['Enums']['security_event_type'];

interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  description: string | null;
  user_id: string | null;
  created_at: string;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

const eventConfig: Record<SecurityEventType, { icon: typeof Shield; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  login_success: { icon: LogIn, label: 'Login', variant: 'default' },
  login_failure: { icon: Ban, label: 'Failed Login', variant: 'destructive' },
  password_change: { icon: Key, label: 'Password Change', variant: 'secondary' },
  mfa_enabled: { icon: Smartphone, label: 'MFA Enabled', variant: 'default' },
  mfa_disabled: { icon: Smartphone, label: 'MFA Disabled', variant: 'secondary' },
  suspicious_activity: { icon: AlertTriangle, label: 'Suspicious', variant: 'destructive' },
  permission_denied: { icon: Ban, label: 'Access Denied', variant: 'destructive' },
  data_export: { icon: Download, label: 'Data Export', variant: 'outline' },
};

function getEventDisplay(event: SecurityEvent) {
  const config = eventConfig[event.event_type] || { icon: Shield, label: event.event_type, variant: 'outline' as const };
  
  // Check metadata for logout/timeout events
  const metadata = event.metadata as Record<string, unknown> | null;
  if (metadata?.action === 'logout') {
    return { icon: LogOut, label: 'Logout', variant: 'secondary' as const };
  }
  if (metadata?.action === 'session_timeout') {
    return { icon: LogOut, label: 'Session Timeout', variant: 'outline' as const };
  }
  
  return config;
}

function getBrowserInfo(userAgent: string | null): string {
  if (!userAgent) return 'Unknown';
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Browser';
}

export function SecurityEventsViewer() {
  const { currentCompanyId } = useAuth();

  const { data: events, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['security-events', currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      
      const { data, error } = await supabase
        .from('security_events')
        .select('id, event_type, description, user_id, created_at, user_agent, metadata')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SecurityEvent[];
    },
    enabled: !!currentCompanyId,
    staleTime: 1000 * 60, // 1 minute
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p>Unable to load security events</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Events
            </CardTitle>
            <CardDescription>
              Recent login, logout, and security activity
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-1">
              {events.map((event) => {
                const display = getEventDisplay(event);
                const Icon = display.icon;
                
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <div className="p-2 rounded-full bg-muted flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={display.variant} className="text-xs">
                          {display.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getBrowserInfo(event.user_agent)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {event.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground" title={format(new Date(event.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No security events recorded</p>
            <p className="text-sm mt-1">Events will appear here as users interact with the system</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
