import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, CreditCard, Clock, ChevronLeft, ChevronRight,
  Building2, TrendingUp, TrendingDown, Snowflake, Play, DollarSign
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const eventTypeConfig: Record<string, { label: string; color: string; icon: typeof CreditCard }> = {
  trial_started: { label: 'Trial Started', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Play },
  trial_extended: { label: 'Trial Extended', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', icon: Clock },
  trial_expired: { label: 'Trial Expired', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  subscription_created: { label: 'Subscription Created', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CreditCard },
  subscription_upgraded: { label: 'Upgraded', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: TrendingUp },
  subscription_downgraded: { label: 'Downgraded', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: TrendingDown },
  subscription_canceled: { label: 'Canceled', color: 'bg-destructive/20 text-destructive', icon: CreditCard },
  subscription_renewed: { label: 'Renewed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CreditCard },
  payment_succeeded: { label: 'Payment Success', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: DollarSign },
  payment_failed: { label: 'Payment Failed', color: 'bg-destructive/20 text-destructive', icon: DollarSign },
  company_frozen: { label: 'Company Frozen', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Snowflake },
  company_unfrozen: { label: 'Company Unfrozen', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Play },
  plan_assigned: { label: 'Plan Assigned', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: CreditCard },
};

export default function PlatformBillingLogsPage() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-billing-logs', search, eventFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('billing_logs')
        .select(`
          *,
          companies:company_id (name),
          plans:plan_id (name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Filter by company name if search is provided
      let filteredData = data || [];
      if (search) {
        filteredData = filteredData.filter(log => 
          (log.companies as any)?.name?.toLowerCase().includes(search.toLowerCase())
        );
      }

      return { logs: filteredData, total: count || 0 };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['platform-billing-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data } = await supabase
        .from('billing_logs')
        .select('event_type')
        .gte('created_at', startOfMonth);

      const frozen = data?.filter(e => e.event_type === 'company_frozen').length || 0;
      const upgrades = data?.filter(e => e.event_type === 'subscription_upgraded' || e.event_type === 'subscription_created').length || 0;
      const trials = data?.filter(e => e.event_type === 'trial_started').length || 0;

      return { frozen, upgrades, trials, total: data?.length || 0 };
    },
  });

  const totalPages = Math.ceil((logs?.total || 0) / pageSize);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Logs</h1>
        <p className="text-muted-foreground">Platform-wide billing and subscription lifecycle events</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">billing events</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New Trials</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trials}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upgrades</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.upgrades}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Companies Frozen</CardTitle>
              <Snowflake className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.frozen}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {Object.entries(eventTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Events</CardTitle>
          <CardDescription>
            Showing {logs?.logs.length || 0} of {logs?.total || 0} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs?.logs && logs.logs.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="min-w-[700px] md:min-w-0">
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
                      {logs.logs.map((log) => {
                        const config = eventTypeConfig[log.event_type] || { label: log.event_type, color: 'bg-muted', icon: CreditCard };
                        const Icon = config.icon;

                        return (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-sm">{format(new Date(log.created_at), 'MMM d, HH:mm')}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{(log.companies as any)?.name || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <Badge className={config.color}>{config.label}</Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(log.plans as any)?.name || '-'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {log.amount ? `${log.currency || 'USD'} ${log.amount}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
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
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No billing events found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}