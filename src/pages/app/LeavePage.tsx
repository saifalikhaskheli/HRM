import { useState, useMemo } from 'react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Calendar, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WriteGate, RoleGate, PermGate } from '@/components/PermissionGate';
import { TablePagination } from '@/components/ui/table-pagination';
import { usePermission } from '@/contexts/PermissionContext';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useMyLeaveRequests, usePendingLeaveRequests, useApproveLeaveRequest, useRejectLeaveRequest, useCancelLeaveRequest } from '@/hooks/useLeave';
import { useMyLeaveBalances, useAllEmployeeLeaveBalances, useAccrueLeaveBalances } from '@/hooks/useLeaveBalances';
import { LeaveRequestFormV2 } from '@/components/leave/LeaveRequestFormV2';
import { LeaveBalanceCard } from '@/components/leave/LeaveBalanceCard';
import { LeaveBalanceTable } from '@/components/leave/LeaveBalanceTable';
import { TeamLeaveRequestRow } from '@/components/leave/TeamLeaveRequestRow';
import { LeaveCalendarView } from '@/components/leave/LeaveCalendarView';
import { LeaveTypesManager } from '@/components/leave/LeaveTypesManager';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
};

export default function LeavePage() {
  const { data: myRequests, isLoading: loadingMy } = useMyLeaveRequests();
  const { data: pendingRequests, isLoading: loadingPending } = usePendingLeaveRequests();
  const { data: myBalances, isLoading: loadingBalances } = useMyLeaveBalances();
  const { data: allBalances, isLoading: loadingAllBalances } = useAllEmployeeLeaveBalances();
  const approveRequest = useApproveLeaveRequest();
  const rejectRequest = useRejectLeaveRequest();
  const cancelRequest = useCancelLeaveRequest();
  const accrueBalances = useAccrueLeaveBalances();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [myLeavePage, setMyLeavePage] = useState(1);
  const PAGE_SIZE = 10;

  const paginatedMyRequests = useMemo(() => {
    if (!myRequests) return [];
    const start = (myLeavePage - 1) * PAGE_SIZE;
    return myRequests.slice(start, start + PAGE_SIZE);
  }, [myRequests, myLeavePage]);

  const actions = (
    <PermGate module="leave" action="create">
      <WriteGate>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Leave Request</DialogTitle>
            </DialogHeader>
            <LeaveRequestFormV2 onSuccess={() => setIsFormOpen(false)} onCancel={() => setIsFormOpen(false)} />
          </DialogContent>
        </Dialog>
      </WriteGate>
    </PermGate>
  );

  return (
    <ModuleGuard moduleId="leave">
      <PageContainer>
        <PageHeader 
          title="Leave Management" 
          description="Request and manage time off"
          actions={actions}
        />

        <Tabs defaultValue="my-leave" className="space-y-4">
          <TabsList className="h-9 w-auto p-1">
            <TabsTrigger value="my-leave" className="text-sm px-3 py-1.5">My Leave</TabsTrigger>
            <PermGate module="leave" action="approve">
              <TabsTrigger value="team" className="text-sm px-3 py-1.5">
                Team Requests
                {pendingRequests && pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
            </PermGate>
            <PermGate module="leave" action="read">
              <RoleGate role="hr_manager">
                <TabsTrigger value="calendar" className="text-sm px-3 py-1.5">Calendar</TabsTrigger>
                <TabsTrigger value="balances" className="text-sm px-3 py-1.5">All Balances</TabsTrigger>
                <TabsTrigger value="settings" className="text-sm px-3 py-1.5">Settings</TabsTrigger>
              </RoleGate>
            </PermGate>
          </TabsList>

          <TabsContent value="my-leave" className="space-y-4">
            {/* Leave Balance Card */}
            <LeaveBalanceCard balances={myBalances} isLoading={loadingBalances} />

            <Card>
              <CardHeader>
                <CardTitle>My Leave Requests</CardTitle>
                <CardDescription>View and manage your leave requests</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMy ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !myRequests?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No leave requests found.</p>
                    <p className="text-sm mt-1">Click "Request Leave" to submit your first request.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[600px] md:min-w-0">
                      <TooltipProvider>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Dates</TableHead>
                              <TableHead>Days</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Response</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedMyRequests.map((req) => (
                              <TableRow key={req.id}>
                                <TableCell>
                                  <Badge style={{ backgroundColor: (req as any).leave_type?.color }} variant="secondary">
                                    {(req as any).leave_type?.name}
                                  </Badge>
                                </TableCell>
                                <TableCell>{format(new Date(req.start_date), 'MMM d')} - {format(new Date(req.end_date), 'MMM d, yyyy')}</TableCell>
                                <TableCell>{req.total_days}</TableCell>
                                <TableCell><Badge className={statusColors[req.status]}>{req.status}</Badge></TableCell>
                                <TableCell className="max-w-[200px]">
                                  {req.status === 'rejected' && req.review_notes ? (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-destructive">Rejection reason:</p>
                                      <p className="text-sm text-muted-foreground line-clamp-2">{req.review_notes}</p>
                                    </div>
                                  ) : req.status === 'approved' && req.review_notes ? (
                                    <Tooltip>
                                      <TooltipTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3 w-3" />
                                        Manager note
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="text-sm">{req.review_notes}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {req.status === 'pending' && (
                                    <WriteGate>
                                      <Button variant="ghost" size="sm" onClick={() => cancelRequest.mutate(req.id)}>Cancel</Button>
                                    </WriteGate>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TooltipProvider>
                    </div>
                    <TablePagination
                      currentPage={myLeavePage}
                      totalItems={myRequests?.length || 0}
                      pageSize={PAGE_SIZE}
                      onPageChange={setMyLeavePage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <PermGate module="leave" action="approve">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                  <CardDescription>Review and approve team leave requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPending ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : !pendingRequests?.length ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No pending requests.</p>
                      <p className="text-sm mt-1">All leave requests have been reviewed.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRequests.map((req) => (
                          <TeamLeaveRequestRow
                            key={req.id}
                            request={{
                              id: req.id,
                              start_date: req.start_date,
                              end_date: req.end_date,
                              total_days: req.total_days,
                              reason: req.reason,
                              employee: (req as any).employee,
                              leave_type: (req as any).leave_type,
                            }}
                            onApprove={(id) => approveRequest.mutate({ id })}
                            onReject={(id, reason) => rejectRequest.mutate({ id, review_notes: reason })}
                            isApproving={approveRequest.isPending}
                            isRejecting={rejectRequest.isPending}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </PermGate>
          </TabsContent>

          <TabsContent value="calendar">
            <PermGate module="leave" action="read">
              <LeaveCalendarView />
            </PermGate>
          </TabsContent>

          <TabsContent value="balances">
            <PermGate module="leave" action="read">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <RoleGate role="hr_manager">
                    <WriteGate>
                      <Button
                        variant="outline"
                        onClick={() => accrueBalances.mutate(new Date().getFullYear())}
                        disabled={accrueBalances.isPending}
                      >
                        {accrueBalances.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Accrue Balances for {new Date().getFullYear()}
                      </Button>
                    </WriteGate>
                  </RoleGate>
                </div>
                <LeaveBalanceTable data={allBalances} isLoading={loadingAllBalances} />
              </div>
            </PermGate>
          </TabsContent>

          <TabsContent value="settings">
            <PermGate module="leave" action="read">
              <LeaveTypesManager />
            </PermGate>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </ModuleGuard>
  );
}
