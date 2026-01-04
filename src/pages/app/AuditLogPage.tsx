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
  FileText, Users, Loader2, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useAuditLogs, useAuditLogStats, useAuditLogTables, AuditLogFilters } from '@/hooks/useAuditLogs';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { exportAuditLogsToCSV } from '@/lib/export-utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import';

const actionConfig: Record<AuditAction, { label: string; color: string; icon: any }> = {
  create: { label: 'Create', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: FileText },
  read: { label: 'Read', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Eye },
  update: { label: 'Update', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: FileText },
  delete: { label: 'Delete', color: 'bg-destructive/20 text-destructive', icon: AlertTriangle },
  login: { label: 'Login', color: 'bg-primary/20 text-primary', icon: CheckCircle },
  logout: { label: 'Logout', color: 'bg-muted text-muted-foreground', icon: Info },
  export: { label: 'Export', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Download },
  import: { label: 'Import', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', icon: FileText },
};

function ActionBadge({ action }: { action: AuditAction }) {
  const config = actionConfig[action] || actionConfig.read;
  return (
    <Badge className={config.color}>
      {config.label}
    </Badge>
  );
}

function getUserDisplayName(log: any): string {
  if (log.user_name) return log.user_name;
  if (log.user_email) return log.user_email;
  if (log.user_id) return log.user_id.slice(0, 8) + '...';
  return 'System';
}

function LogDetailDialog({ log }: { log: any }) {
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
        <div>
          <p className="text-sm font-medium text-muted-foreground">User</p>
          <p className="text-sm">{getUserDisplayName(log)}</p>
          {log.user_email && log.user_name && (
            <p className="text-xs text-muted-foreground">{log.user_email}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">IP Address</p>
          <p className="font-mono text-sm">{log.ip_address || '-'}</p>
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

      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;

  const { companyId } = useTenant();
  const { data, isLoading } = useAuditLogs(filters, page, pageSize);
  const { data: stats } = useAuditLogStats();
  const { data: tables } = useAuditLogTables();

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const handleExport = async () => {
    if (!companyId) return;
    
    setIsExporting(true);
    try {
      // Fetch all logs with current filters (up to 10000)
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (filters.action) query = query.eq('action', filters.action);
      if (filters.tableName) query = query.eq('table_name', filters.tableName);
      if (filters.startDate) query = query.gte('created_at', filters.startDate);
      if (filters.endDate) query = query.lte('created_at', filters.endDate);

      const { data: logs, error } = await query;
      
      if (error) throw error;
      if (!logs || logs.length === 0) {
        toast.info('No audit logs to export');
        return;
      }

      exportAuditLogsToCSV(logs);
      toast.success(`Exported ${logs.length} audit logs`);

      // Log the export action
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        action: 'export' as const,
        table_name: 'audit_logs',
        metadata: { exported_count: logs.length },
      }]);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModuleGuard moduleId="audit">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">SOC2-compliant activity tracking and compliance monitoring</p>
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Most Active Table</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {stats.byTable[0]?.table || '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.byTable[0]?.count || 0} events
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Data Changes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byAction.find(a => a.action === 'update')?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">updates this week</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select 
                  value={filters.action || 'all'} 
                  onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? undefined : v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Table</label>
                <Select 
                  value={filters.tableName || 'all'} 
                  onValueChange={(v) => setFilters({ ...filters, tableName: v === 'all' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tables</SelectItem>
                    {tables?.map(table => (
                      <SelectItem key={table} value={table}>{table}</SelectItem>
                    ))}
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

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {data?.logs.length || 0} of {data?.total || 0} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="min-w-[800px] md:min-w-0">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={log.action} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                      <TableCell className="font-mono text-sm truncate max-w-[120px]">
                        {log.record_id?.slice(0, 8) || '-'}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[160px]" title={log.user_email || log.user_id || undefined}>
                        {getUserDisplayName(log)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {String(log.ip_address) || '-'}
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
                              <DialogTitle>Audit Log Details</DialogTitle>
                            </DialogHeader>
                            <LogDetailDialog log={log} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
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
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found.</p>
              <p className="text-sm">Activity will be recorded as users interact with the system.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </ModuleGuard>
  );
}
