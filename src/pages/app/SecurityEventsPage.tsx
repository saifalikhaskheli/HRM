import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Filter, Eye, Download, Shield, Clock, 
  Loader2, ChevronLeft, ChevronRight,
  LogIn, LogOut, Key, Smartphone, AlertTriangle, Ban
} from 'lucide-react';
import { useSecurityEvents } from '@/hooks/useAuditLogs';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';

type SecurityEventType = Database['public']['Enums']['security_event_type'];

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

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-destructive/20 text-destructive',
};

interface SecurityEventsFilters {
  eventType?: SecurityEventType;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

function EventDetailDialog({ event }: { event: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Event Type</p>
          <Badge variant={eventConfig[event.event_type as SecurityEventType]?.variant || 'outline'}>
            {eventConfig[event.event_type as SecurityEventType]?.label || event.event_type}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Severity</p>
          <Badge className={severityColors[event.severity] || severityColors.medium}>
            {event.severity || 'medium'}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
          <p>{format(new Date(event.created_at), 'PPpp')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">User Agent</p>
          <p className="text-sm truncate max-w-[200px]" title={event.user_agent}>
            {event.user_agent_truncated || event.user_agent || '-'}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">IP Address</p>
          <p className="font-mono text-sm">{event.ip_address_masked || event.ip_address || '-'}</p>
        </div>
      </div>

      {event.description && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
          <p className="text-sm bg-muted p-3 rounded-md">{event.description}</p>
        </div>
      )}

      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Details</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function SecurityEventsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SecurityEventsFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;

  const { companyId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['security-events-page', companyId, filters, page, pageSize],
    queryFn: async () => {
      if (!companyId) return { events: [], total: 0 };

      let query = supabase
        .from('security_events')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: events, error, count } = await query;
      if (error) throw error;

      return { events: events || [], total: count || 0 };
    },
    enabled: !!companyId,
  });

  const { data: stats } = useQuery({
    queryKey: ['security-events-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      const [todayResult, weekResult, typesResult] = await Promise.all([
        supabase
          .from('security_events')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfDay),
        supabase
          .from('security_events')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfWeek),
        supabase
          .from('security_events')
          .select('event_type, severity')
          .eq('company_id', companyId)
          .gte('created_at', startOfWeek),
      ]);

      const criticalCount = typesResult.data?.filter(
        e => e.severity === 'high' || e.severity === 'critical'
      ).length || 0;

      return {
        todayCount: todayResult.count || 0,
        weekCount: weekResult.count || 0,
        criticalCount,
      };
    },
    enabled: !!companyId,
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const handleExport = async () => {
    if (!companyId) return;
    
    setIsExporting(true);
    try {
      const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      if (!events || events.length === 0) {
        toast.info('No security events to export');
        return;
      }

      // Create CSV
      const headers = ['Timestamp', 'Event Type', 'Severity', 'Description', 'User Agent', 'IP Address'];
      const rows = events.map(e => [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
        e.event_type,
        e.severity || 'medium',
        e.description || '',
        e.user_agent_truncated || e.user_agent || '',
        e.ip_address_masked || '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${events.length} security events`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export security events');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Events</h1>
          <p className="text-muted-foreground">Monitor login activity, access attempts, and security incidents</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Events</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weekCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.criticalCount}</div>
              <p className="text-xs text-muted-foreground">high/critical severity</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Type</label>
                <Select 
                  value={filters.eventType || 'all'} 
                  onValueChange={(v) => setFilters({ ...filters, eventType: v === 'all' ? undefined : v as SecurityEventType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(eventConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Severity</label>
                <Select 
                  value={filters.severity || 'all'} 
                  onValueChange={(v) => setFilters({ ...filters, severity: v === 'all' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate?.split('T')[0] || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate?.split('T')[0] || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={() => setFilters({})}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
          <CardDescription>
            Showing {data?.events.length || 0} of {data?.total || 0} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.events && data.events.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.map((event) => {
                    const config = eventConfig[event.event_type as SecurityEventType] || { icon: Shield, label: event.event_type, variant: 'outline' as const };
                    const Icon = config.icon;
                    
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">{format(new Date(event.created_at), 'MMM d, HH:mm')}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={config.variant}>{config.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[event.severity || 'medium']}>
                            {event.severity || 'medium'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {event.description || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.ip_address_masked || '-'}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Security Event Details</DialogTitle>
                              </DialogHeader>
                              <EventDetailDialog event={event} />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events found.</p>
              <p className="text-sm">Security events will be recorded as users interact with the system.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}