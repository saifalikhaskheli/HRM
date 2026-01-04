import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  Search, Eye, Shield, Clock, ChevronLeft, ChevronRight,
  Mail, CreditCard, AlertTriangle, CheckCircle, Building2,
  FileText, UserCog, Terminal, Info, AlertCircle, Bug,
  TrendingUp, TrendingDown, Snowflake, Play, DollarSign, Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlatformEmailLogs, usePlatformEmailLogStats, usePlatformCompaniesForFilter, PlatformEmailLogFilters } from '@/hooks/usePlatformEmailLogs';

// Audit action colors
const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  delete: 'bg-destructive/20 text-destructive',
  login: 'bg-primary/20 text-primary',
  logout: 'bg-muted text-muted-foreground',
  export: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

// Billing event config
const billingEventConfig: Record<string, { label: string; color: string; icon: typeof CreditCard }> = {
  trial_started: { label: 'Trial Started', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Play },
  trial_extended: { label: 'Trial Extended', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', icon: Clock },
  trial_expired: { label: 'Trial Expired', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  subscription_created: { label: 'Subscription Created', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CreditCard },
  subscription_upgraded: { label: 'Upgraded', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: TrendingUp },
  subscription_downgraded: { label: 'Downgraded', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: TrendingDown },
  subscription_canceled: { label: 'Canceled', color: 'bg-destructive/20 text-destructive', icon: CreditCard },
  company_frozen: { label: 'Company Frozen', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Snowflake },
  company_unfrozen: { label: 'Company Unfrozen', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Play },
  plan_assigned: { label: 'Plan Assigned', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: CreditCard },
  payment_succeeded: { label: 'Payment Success', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: DollarSign },
  payment_failed: { label: 'Payment Failed', color: 'bg-destructive/20 text-destructive', icon: DollarSign },
};

// App log level config
const levelConfig: Record<string, { label: string; color: string; icon: typeof Info }> = {
  debug: { label: 'Debug', color: 'bg-muted text-muted-foreground', icon: Bug },
  info: { label: 'Info', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Info },
  warn: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertTriangle },
  error: { label: 'Error', color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
  critical: { label: 'Critical', color: 'bg-red-600 text-white', icon: AlertCircle },
};

function EmailStatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  const config = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    sent: { label: 'Sent', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    failed: { label: 'Failed', icon: AlertTriangle, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };
  const { label, icon: Icon, className } = config[status];
  return <Badge variant="outline" className={cn('gap-1', className)}><Icon className="h-3 w-3" />{label}</Badge>;
}

// Audit Logs Tab
function AuditLogsTab() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: companies } = useQuery({
    queryKey: ['platform-companies-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit-logs', search, actionFilter, companyFilter, page],
    queryFn: async () => {
      let query = supabase.from('audit_logs').select(`*, companies:company_id (name)`, { count: 'exact' }).order('created_at', { ascending: false });
      if (actionFilter !== 'all') query = query.eq('action', actionFilter as any);
      if (companyFilter !== 'all') query = query.eq('company_id', companyFilter);
      if (search) query = query.or(`table_name.ilike.%${search}%,record_id.ilike.%${search}%`);
      query = query.range((page - 1) * pageSize, page * pageSize - 1);
      const { data: logs, count, error } = await query;
      if (error) throw error;
      return { logs: logs || [], total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search table or record ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="All companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Platform Audit Logs</CardTitle><CardDescription>Showing {data?.logs.length || 0} of {data?.total || 0}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Record ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>{(log.companies as any)?.name || '-'}</TableCell>
                      <TableCell><Badge className={actionColors[log.action as keyof typeof actionColors] || 'bg-muted'}>{log.action}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                      <TableCell className="font-mono text-sm truncate max-w-[100px]">{log.record_id?.slice(0, 8) || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No audit logs found.</p></div>
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

// Impersonation Logs Tab
function ImpersonationLogsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-impersonation-logs', search, page],
    queryFn: async () => {
      let query = supabase.from('impersonation_logs').select(`*, companies:company_id (name)`, { count: 'exact' }).order('created_at', { ascending: false });
      if (search) query = query.ilike('action', `%${search}%`);
      query = query.range((page - 1) * pageSize, page * pageSize - 1);
      const { data: logs, count, error } = await query;
      if (error) throw error;
      return { logs: logs || [], total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader><CardTitle>Impersonation Logs</CardTitle><CardDescription>Showing {data?.logs?.length || 0} of {data?.total || 0}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>{(log.companies as any)?.name || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No impersonation logs found.</p></div>
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

// Billing Logs Tab
function BillingLogsTab() {
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-logs', eventFilter, page],
    queryFn: async () => {
      let query = supabase.from('billing_logs').select(`*, companies:company_id (name), plans:plan_id (name)`, { count: 'exact' }).order('created_at', { ascending: false });
      if (eventFilter !== 'all') query = query.eq('event_type', eventFilter);
      query = query.range((page - 1) * pageSize, page * pageSize - 1);
      const { data: logs, count, error } = await query;
      if (error) throw error;
      return { logs: logs || [], total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <Select value={eventFilter} onValueChange={setEventFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="All events" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All events</SelectItem>
          {Object.entries(billingEventConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card>
        <CardHeader><CardTitle>Billing Events</CardTitle><CardDescription>Showing {data?.logs?.length || 0} of {data?.total || 0}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log: any) => {
                    const config = billingEventConfig[log.event_type] || { label: log.event_type, color: 'bg-muted', icon: CreditCard };
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                        <TableCell>{(log.companies as any)?.name || '-'}</TableCell>
                        <TableCell><Badge className={config.color}>{config.label}</Badge></TableCell>
                        <TableCell>{(log.plans as any)?.name || '-'}</TableCell>
                        <TableCell className="font-mono">{log.amount ? `${log.currency || 'USD'} ${log.amount}` : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No billing events found.</p></div>
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
  const [filters, setFilters] = useState<PlatformEmailLogFilters>({ status: 'all', search: '', companyId: '' });
  const { data: logs, isLoading, refetch, isRefetching } = usePlatformEmailLogs(filters);
  const { data: stats } = usePlatformEmailLogStats();
  const { data: companies } = usePlatformCompaniesForFilter();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="p-2 rounded-lg bg-muted"><Mail className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{stats?.total || 0}</p><p className="text-sm text-muted-foreground">Total</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="p-2 rounded-lg bg-muted"><CheckCircle className="h-5 w-5 text-emerald-500" /></div><div><p className="text-2xl font-bold">{stats?.sent || 0}</p><p className="text-sm text-muted-foreground">Sent</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="p-2 rounded-lg bg-muted"><AlertTriangle className="h-5 w-5 text-red-500" /></div><div><p className="text-2xl font-bold">{stats?.failed || 0}</p><p className="text-sm text-muted-foreground">Failed</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="p-2 rounded-lg bg-muted"><Clock className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{stats?.pending || 0}</p><p className="text-sm text-muted-foreground">Pending</p></div></CardContent></Card>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search recipient or subject..." value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-9" />
        </div>
        <Select value={filters.companyId || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, companyId: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-[200px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="All companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v: any) => setFilters(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}><Activity className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />Refresh</Button>
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
                    <TableHead>Company</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>{log.company_name || 'Platform'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.recipient_email}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                      <TableCell><EmailStatusBadge status={log.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><Mail className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No email logs found.</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Application Logs Tab
function ApplicationLogsTab() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-application-logs', search, levelFilter, page],
    queryFn: async () => {
      let query = supabase.from('application_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (levelFilter !== 'all') query = query.eq('level', levelFilter);
      if (search) query = query.ilike('message', `%${search}%`);
      query = query.range((page - 1) * pageSize, page * pageSize - 1);
      const { data: logs, count, error } = await query;
      if (error) throw error;
      return { logs: logs || [], total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All levels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {Object.entries(levelConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Application Logs</CardTitle><CardDescription>Showing {data?.logs?.length || 0} of {data?.total || 0}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log: any) => {
                    const config = levelConfig[log.level] || levelConfig.info;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(log.created_at), 'HH:mm:ss')}</TableCell>
                        <TableCell><Badge className={config.color}>{config.label}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{log.service}</TableCell>
                        <TableCell className="max-w-[400px] truncate">{log.message}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground"><Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No application logs found.</p></div>
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

export default function PlatformLogsPage() {
  const [activeTab, setActiveTab] = useState('audit');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Logs</h1>
        <p className="text-muted-foreground">Unified view of all platform-level activity and events</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="impersonation">Impersonation</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-6"><AuditLogsTab /></TabsContent>
        <TabsContent value="impersonation" className="mt-6"><ImpersonationLogsTab /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BillingLogsTab /></TabsContent>
        <TabsContent value="emails" className="mt-6"><EmailLogsTab /></TabsContent>
        <TabsContent value="application" className="mt-6"><ApplicationLogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
