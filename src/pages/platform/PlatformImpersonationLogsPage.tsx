import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Eye, Search, ChevronLeft, ChevronRight, UserCog } from 'lucide-react';

interface ImpersonationLog {
  id: string;
  admin_user_id: string;
  company_id: string;
  company_name: string;
  action: string;
  session_id: string | null;
  user_agent: string | null;
  created_at: string;
  admin_email?: string;
}

export default function PlatformImpersonationLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Fetch impersonation logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-impersonation-logs', search, actionFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('impersonation_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.ilike('company_name', `%${search}%`);
      }

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Fetch admin profiles
      const adminIds = [...new Set(data?.map(log => log.admin_user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', adminIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      return {
        logs: data?.map(log => ({
          ...log,
          admin_email: profileMap.get(log.admin_user_id) || 'Unknown',
        })) as ImpersonationLog[],
        total: count || 0,
      };
    },
  });

  const totalPages = Math.ceil((logs?.total || 0) / pageSize);

  // Group logs by session
  const groupedBySession = logs?.logs.reduce((acc, log) => {
    const sessionId = log.session_id || log.id;
    if (!acc[sessionId]) {
      acc[sessionId] = [];
    }
    acc[sessionId].push(log);
    return acc;
  }, {} as Record<string, ImpersonationLog[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Impersonation History
        </h2>
        <p className="text-muted-foreground">
          Track when platform admins access company accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Impersonation Logs</CardTitle>
          <CardDescription>
            Complete audit trail of admin impersonation sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="start">Start Only</SelectItem>
                <SelectItem value="end">End Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs?.logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No impersonation logs found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Session ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{log.admin_email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{log.company_name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.action === 'start' ? 'default' : 'secondary'}
                          className={log.action === 'start' ? 'bg-blue-500' : ''}
                        >
                          {log.action === 'start' ? 'Started' : 'Ended'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.session_id?.slice(0, 8) || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, logs?.total || 0)} of {logs?.total || 0} logs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}