import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WriteGate } from '@/components/PermissionGate';
import { LeaveRejectDialog } from './LeaveRejectDialog';
import { useEmployeeLeaveBalances } from '@/hooks/useLeaveBalances';
import { Check, X, ChevronDown, ChevronRight, MessageSquare, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  employee: { id: string; first_name: string; last_name: string; department?: { name: string } | null } | null;
  leave_type: { id: string; name: string; color: string | null } | null;
}

interface TeamLeaveRequestRowProps {
  request: LeaveRequest;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function TeamLeaveRequestRow({
  request,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: TeamLeaveRequestRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const employeeId = request.employee?.id || null;
  const { data: balances } = useEmployeeLeaveBalances(employeeId);

  const employeeName = request.employee 
    ? `${request.employee.first_name} ${request.employee.last_name}` 
    : 'Unknown';

  // Find balance for the requested leave type
  const leaveTypeBalance = balances?.find(b => b.leaveTypeId === request.leave_type?.id);
  const remainingAfterRequest = leaveTypeBalance 
    ? leaveTypeBalance.remaining - request.total_days 
    : null;
  const isOverdraw = remainingAfterRequest !== null && remainingAfterRequest < 0;

  const handleRejectConfirm = (reason: string) => {
    onReject(request.id, reason);
    setShowRejectDialog(false);
  };

  return (
    <TooltipProvider>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} asChild>
        <>
          <TableRow className={isExpanded ? 'border-b-0' : ''}>
            <TableCell>
              <div className="flex items-center gap-2">
                {request.reason && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                )}
                <div>
                  <div className="font-medium">{employeeName}</div>
                  {request.employee?.department?.name && (
                    <div className="text-xs text-muted-foreground">{request.employee.department.name}</div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" style={{ backgroundColor: request.leave_type?.color || undefined }}>
                {request.leave_type?.name}
              </Badge>
            </TableCell>
            <TableCell>
              {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d')}
            </TableCell>
            <TableCell>{request.total_days}</TableCell>
            <TableCell>
              {leaveTypeBalance ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1 ${isOverdraw ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {isOverdraw && <AlertTriangle className="h-3 w-3" />}
                      <span className="text-sm">
                        {leaveTypeBalance.remaining} days left
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div>Allocated: {leaveTypeBalance.allocated} days</div>
                      <div>Used: {leaveTypeBalance.used} days</div>
                      <div>Pending: {leaveTypeBalance.pending} days</div>
                      {isOverdraw && (
                        <div className="text-destructive font-medium">
                          Will overdraw by {Math.abs(remainingAfterRequest!)} days
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {request.reason ? (
                <Tooltip>
                  <TooltipTrigger>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{request.reason}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <WriteGate>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => onApprove(request.id)}
                        disabled={isApproving || isRejecting}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Approve</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => setShowRejectDialog(true)}
                        disabled={isApproving || isRejecting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reject</TooltipContent>
                  </Tooltip>
                </WriteGate>
              </div>
            </TableCell>
          </TableRow>

          <CollapsibleContent asChild>
            <TableRow className="bg-muted/30">
              <TableCell colSpan={7} className="py-3">
                <div className="pl-8">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Reason for leave:</div>
                  <p className="text-sm">{request.reason || 'No reason provided'}</p>
                </div>
              </TableCell>
            </TableRow>
          </CollapsibleContent>

          <LeaveRejectDialog
            open={showRejectDialog}
            onOpenChange={setShowRejectDialog}
            employeeName={employeeName}
            onConfirm={handleRejectConfirm}
            isLoading={isRejecting}
          />
        </>
      </Collapsible>
    </TooltipProvider>
  );
}
