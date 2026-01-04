import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Terminal, Clock, ChevronLeft, ChevronRight, Eye,
  AlertCircle, AlertTriangle, Info, Bug
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const levelConfig: Record<string, { label: string; color: string; icon: typeof Info }> = {
  debug: { label: 'Debug', color: 'bg-muted text-muted-foreground', icon: Bug },
  info: { label: 'Info', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Info },
  warn: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertTriangle },
  error: { label: 'Error', color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
  critical: { label: 'Critical', color: 'bg-red-600 text-white', icon: AlertCircle },
};

function LogDetailDialog({ log }: { log: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Service</p>
          <p className="font-mono">{log.service}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Level</p>
          <Badge className={levelConfig[log.level]?.color || levelConfig.info.color}>
            {levelConfig[log.level]?.label || log.level}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
          <p>{format(new Date(log.created_at), 'PPpp')}</p>
        </div>
        {log.duration_ms && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Duration</p>
            <p>{log.duration_ms}ms</p>
          </div>
        )}
        {log.request_id && (
          <div className="col-span-2">
            <p className="text-sm font-medium text-muted-foreground">Request ID</p>
            <p className="font-mono text-sm">{log.request_id}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
        <p className="text-sm bg-muted p-3 rounded-md">{log.message}</p>
      </div>

      {log.error_code && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Error Code</p>
          <p className="font-mono text-sm text-destructive">{log.error_code}</p>
        </div>
      )}

      {log.error_stack && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Stack Trace</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {log.error_stack}
          </pre>
        </div>
      )}

      {log.context && Object.keys(log.context).length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Context</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
            {JSON.stringify(log.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function PlatformApplicationLogsPage() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: services } = useQuery({
    queryKey: ['platform-app-log-services'],
    queryFn: async () => {
      const { data } = await supabase
        .from('application_logs')
        .select('service')
        .limit(1000);

      const uniqueServices = [...new Set(data?.map(d => d.service))].sort();
      return uniqueServices;
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-application-logs', search, levelFilter, serviceFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('application_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }
      if (serviceFilter !== 'all') {
        query = query.eq('service', serviceFilter);
      }
      if (search) {
        query = query.ilike('message', `%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { logs: data || [], total: count || 0 };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['platform-app-log-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data } = await supabase
        .from('application_logs')
        .select('level')
        .gte('created_at', startOfDay);

      const errors = data?.filter(e => e.level === 'error' || e.level === 'critical').length || 0;
      const warnings = data?.filter(e => e.level === 'warn').length || 0;

      return { total: data?.length || 0, errors, warnings };
    },
  });

  const totalPages = Math.ceil((logs?.total || 0) / pageSize);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application Logs</h1>
        <p className="text-muted-foreground">System-level logs for edge functions and platform services</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">log entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.errors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {Object.entries(levelConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services?.map((service) => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Log Entries</CardTitle>
          <CardDescription>
            Showing {logs?.logs.length || 0} of {logs?.total || 0} entries
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
                        <TableHead>Level</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.logs.map((log) => {
                        const config = levelConfig[log.level] || levelConfig.info;
                        const Icon = config.icon;

                        return (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-sm">{format(new Date(log.created_at), 'HH:mm:ss')}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), 'MMM d')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <Badge className={config.color}>{config.label}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.service}
                            </TableCell>
                            <TableCell className="max-w-[400px] truncate">
                              {log.message}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Log Details</DialogTitle>
                                  </DialogHeader>
                                  <LogDetailDialog log={log} />
                                </DialogContent>
                              </Dialog>
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
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No application logs found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}