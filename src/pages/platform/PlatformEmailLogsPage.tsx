import { useState } from 'react';
import { usePlatformEmailLogs, usePlatformEmailLogStats, usePlatformCompaniesForFilter, PlatformEmailLogFilters } from '@/hooks/usePlatformEmailLogs';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCw,
  Eye,
  Send,
  MailX,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function StatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  const config = {
    pending: { 
      label: 'Pending', 
      icon: Clock,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    },
    sent: { 
      label: 'Sent', 
      icon: CheckCircle2,
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    },
    failed: { 
      label: 'Failed', 
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  className 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformEmailLogsPage() {
  const [filters, setFilters] = useState<PlatformEmailLogFilters>({
    status: 'all',
    search: '',
    companyId: '',
  });

  const { data: logs, isLoading, refetch, isRefetching } = usePlatformEmailLogs(filters);
  const { data: stats } = usePlatformEmailLogStats();
  const { data: companies } = usePlatformCompaniesForFilter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Audit Logs</h1>
        <p className="text-muted-foreground">
          Track and audit all emails sent across the platform
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Emails" 
          value={stats?.total || 0} 
          icon={Mail} 
        />
        <StatsCard 
          title="Sent" 
          value={stats?.sent || 0} 
          icon={Send}
        />
        <StatsCard 
          title="Failed" 
          value={stats?.failed || 0} 
          icon={MailX}
        />
        <StatsCard 
          title="Pending" 
          value={stats?.pending || 0} 
          icon={Clock}
        />
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex-1 flex gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by recipient or subject..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-9"
                />
              </div>

              {/* Company Filter */}
              <Select
                value={filters.companyId || 'all'}
                onValueChange={(value) => 
                  setFilters(f => ({ ...f, companyId: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={filters.status}
                onValueChange={(value: 'all' | 'pending' | 'sent' | 'failed') => 
                  setFilters(f => ({ ...f, status: value }))
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {log.company_name || 'Platform'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{log.recipient_email}</p>
                          {log.recipient_name && (
                            <p className="text-sm text-muted-foreground truncate">{log.recipient_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.subject}
                      </TableCell>
                      <TableCell>
                        {log.template_type ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.template_type.replace(/_/g, ' ')}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={log.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {log.provider || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Email Details</DialogTitle>
                              <DialogDescription>
                                Sent on {format(new Date(log.created_at), 'PPpp')}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                                  <StatusBadge status={log.status} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Provider</p>
                                  <p>{log.provider || 'N/A'}</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Company</p>
                                <p>{log.company_name || 'Platform'}</p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Recipient</p>
                                <p>{log.recipient_email}</p>
                                {log.recipient_name && (
                                  <p className="text-sm text-muted-foreground">{log.recipient_name}</p>
                                )}
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

                              {log.triggered_from && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Triggered From</p>
                                  <p className="font-mono text-sm">{log.triggered_from}</p>
                                </div>
                              )}

                              {log.message_id && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Message ID</p>
                                  <p className="font-mono text-xs break-all">{log.message_id}</p>
                                </div>
                              )}

                              {log.error_message && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                  <p className="text-sm font-medium text-destructive mb-1">Error</p>
                                  <p className="text-sm text-destructive/90">{log.error_message}</p>
                                  {log.error_code && (
                                    <p className="text-xs text-destructive/70 mt-1">Code: {log.error_code}</p>
                                  )}
                                </div>
                              )}

                              {log.sent_at && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Sent At</p>
                                  <p>{format(new Date(log.sent_at), 'PPpp')}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No email logs found</h3>
              <p className="text-muted-foreground">
                {filters.search || filters.status !== 'all' || filters.companyId
                  ? 'Try adjusting your filters'
                  : 'Emails sent from the platform will appear here'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
