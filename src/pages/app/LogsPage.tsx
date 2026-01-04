import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, Filter, Eye, Download, Shield, Clock, 
  FileText, Loader2, ChevronLeft, ChevronRight,
  Mail, CreditCard, AlertTriangle, CheckCircle, Info,
  LogIn, LogOut, Key, Smartphone, Ban, Activity
} from 'lucide-react';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useAuditLogs, useAuditLogStats, useAuditLogTables, AuditLogFilters } from '@/hooks/useAuditLogs';
import { useEmailLogs, useEmailLogStats, EmailLogFilters } from '@/hooks/useEmailLogs';
import { useTenant } from '@/contexts/TenantContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { exportAuditLogsToCSV } from '@/lib/export-utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import';
type SecurityEventType = Database['public']['Enums']['security_event_type'];

// Audit action config
const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  create: { label: 'Create', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  read: { label: 'Read', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  update: { label: 'Update', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  delete: { label: 'Delete', color: 'bg-destructive/20 text-destructive' },
  login: { label: 'Login', color: 'bg-primary/20 text-primary' },
  logout: { label: 'Logout', color: 'bg-muted text-muted-foreground' },
  export: { label: 'Export', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  import: { label: 'Import', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
};

// Security event config
const securityEventConfig: Record<SecurityEventType, { icon: typeof Shield; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
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

function ActionBadge({ action }: { action: AuditAction }) {
  const config = actionConfig[action] || actionConfig.read;
  return <Badge className={config.color}>{config.label}</Badge>;
}

function EmailStatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  const config = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    sent: { label: 'Sent', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    failed: { label: 'Failed', icon: AlertTriangle, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// Log Detail Dialog
function LogDetailDialog({ log, type }: { log: any; type: 'audit' | 'security' | 'email' }) {
  if (type === 'email') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <EmailStatusBadge status={log.status} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Provider</p>
            <p>{log.provider || 'N/A'}</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Recipient</p>
          <p>{log.recipient_email}</p>
          {log.recipient_name && <p className="text-sm text-muted-foreground">{log.recipient_name}</p>}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Subject</p>
          <p>{log.subject}</p>
        </div>
        {log.template_type && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Template</p>
            <Badge variant="outline">{log.template_type}</Badge>
          </div>
        )}
        {log.error_message && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-1">Error</p>
            <p className="text-sm text-destructive/90">{log.error_message}</p>
          </div>
        )}
      </div>
    );
  }

  if (type === 'security') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Event Type</p>
            <Badge variant={securityEventConfig[log.event_type as SecurityEventType]?.variant || 'outline'}>
              {securityEventConfig[log.event_type as SecurityEventType]?.label || log.event_type}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Severity</p>
            <Badge className={severityColors[log.severity] || severityColors.medium}>
              {log.severity || 'medium'}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
            <p>{format(new Date(log.created_at), 'PPpp')}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">IP Address</p>
            <p className="font-mono text-sm">{log.ip_address_masked || '-'}</p>
          </div>
        </div>
        {log.description && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
            <p className="text-sm bg-muted p-3 rounded-md">{log.description}</p>
          </div>
        )}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Details</p>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Audit log
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Action</p>
          <ActionBadge action={log.action} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Table</p>
          <p className="font-mono text-sm">{log.table_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
          <p>{format(new Date(log.created_at), 'PPpp')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Record ID</p>
          <p className="font-mono text-sm truncate">{log.record_id || '-'}</p>
        </div>
      </div>
      {log.old_values && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Previous Values</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
            {JSON.stringify(log.old_values, null, 2)}
          </pre>
        </div>
      )}
      {log.new_values && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">New Values</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
            {JSON.stringify(log.new_values, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Audit Logs Tab
function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 50;

  const { companyId } = useTenant();
  const { data, isLoading } = useAuditLogs(filters, page, pageSize);
  const { data: stats } = useAuditLogStats();
  const { data: tables } = useAuditLogTables();

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
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
              <CardTitle className="text-sm font-medium">Most Active</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">{stats.byTable[0]?.table || '-'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Updates</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byAction.find(a => a.action === 'update')?.count || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Select 
                value={filters.action || 'all'} 
                onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? undefined : v as any })}
              >
                <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={filters.tableName || 'all'} 
                onValueChange={(v) => setFilters({ ...filters, tableName: v === 'all' ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="All tables" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {tables?.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filters.startDate?.split('T')[0] || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })}
                placeholder="Start date"
              />
              <Input
                type="date"
                value={filters.endDate?.split('T')[0] || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })}
                placeholder="End date"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Showing {data?.logs.length || 0} of {data?.total || 0} events</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell><ActionBadge action={log.action} /></TableCell>
                      <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                      <TableCell className="text-sm truncate max-w-[160px]">{log.user_email || log.user_id?.slice(0, 8) || 'System'}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Audit Log Details</DialogTitle></DialogHeader>
                            <LogDetailDialog log={log} type="audit" />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Security Events Tab
function SecurityEventsTab() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<string>('all');
  const pageSize = 50;
  const { companyId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['security-events-unified', companyId, eventType, page],
    queryFn: async () => {
      if (!companyId) return { events: [], total: 0 };
      let query = supabase.from('security_events').select('*', { count: 'exact' })
        .eq('company_id', companyId).order('created_at', { ascending: false });
      if (eventType !== 'all') query = query.eq('event_type', eventType as any);
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
      const { data: events, error, count } = await query;
      if (error) throw error;
      return { events: events || [], total: count || 0 };
    },
    enabled: !!companyId,
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All events" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {Object.entries(securityEventConfig).map(([type, config]) => (
              <SelectItem key={type} value={type}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
          <CardDescription>Showing {data?.events.length || 0} of {data?.total || 0} events</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.events && data.events.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.map((event) => {
                    const eventType = event.event_type as SecurityEventType;
                    const config = securityEventConfig[eventType] || { icon: Shield, label: event.event_type || 'Unknown', variant: 'outline' as const };
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(event.created_at), 'MMM d, HH:mm')}</TableCell>
                        <TableCell><Badge variant={config.variant}>{config.label}</Badge></TableCell>
                        <TableCell><Badge className={severityColors[event.severity || 'medium']}>{event.severity || 'medium'}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{event.description || '-'}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader><DialogTitle>Security Event Details</DialogTitle></DialogHeader>
                              <LogDetailDialog log={event} type="security" />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events found.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Email Logs Tab
function EmailLogsTab() {
  const [filters, setFilters] = useState<EmailLogFilters>({ status: 'all', search: '' });
  const { data: logs, isLoading, refetch, isRefetching } = useEmailLogs(filters);
  const { data: stats } = useEmailLogStats();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-muted"><Mail className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-2xl font-bold">{stats?.total || 0}</p><p className="text-sm text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-muted"><CheckCircle className="h-5 w-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-bold">{stats?.sent || 0}</p><p className="text-sm text-muted-foreground">Sent</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-muted"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            <div><p className="text-2xl font-bold">{stats?.failed || 0}</p><p className="text-sm text-muted-foreground">Failed</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-muted"><Clock className="h-5 w-5 text-amber-500" /></div>
            <div><p className="text-2xl font-bold">{stats?.pending || 0}</p><p className="text-sm text-muted-foreground">Pending</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient or subject..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-9"
          />
        </div>
        <Select value={filters.status} onValueChange={(v: any) => setFilters(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <Activity className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Email Logs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.recipient_email}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell><EmailStatusBadge status={log.status as 'pending' | 'sent' | 'failed'} /></TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader><DialogTitle>Email Details</DialogTitle></DialogHeader>
                            <LogDetailDialog log={log} type="email" />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No email logs found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LogsPage() {
  const { isAdmin } = useTenant();
  const { isHROrAbove, isCompanyAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState('audit');

  // Permissions: HR gets audit only, Admin gets all
  const canViewAudit = isHROrAbove || isCompanyAdmin;
  const canViewSecurity = isCompanyAdmin;
  const canViewEmails = isCompanyAdmin;

  if (!canViewAudit) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-2" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view logs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <ModuleGuard moduleId="audit">
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">Unified view of all system activity and events</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            {canViewSecurity && <TabsTrigger value="security">Security</TabsTrigger>}
            {canViewEmails && <TabsTrigger value="emails">Emails</TabsTrigger>}
          </TabsList>

          <TabsContent value="audit" className="mt-6">
            <AuditLogsTab />
          </TabsContent>

          {canViewSecurity && (
            <TabsContent value="security" className="mt-6">
              <SecurityEventsTab />
            </TabsContent>
          )}

          {canViewEmails && (
            <TabsContent value="emails" className="mt-6">
              <EmailLogsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ModuleGuard>
  );
}
