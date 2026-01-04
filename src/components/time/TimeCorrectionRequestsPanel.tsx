import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePendingTimeCorrectionRequests,
  useApproveTimeCorrectionRequest,
  useRejectTimeCorrectionRequest,
  useRequestClarification,
  type TimeCorrectionRequest,
} from '@/hooks/useTimeCorrectionRequests';

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    case 'approved':
      return <Badge className="gap-1 bg-green-600"><Check className="h-3 w-3" /> Approved</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Rejected</Badge>;
    case 'clarification_needed':
      return <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" /> Clarification</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TimeCorrectionRequestsPanel() {
  const { data: requests, isLoading } = usePendingTimeCorrectionRequests();
  const approveRequest = useApproveTimeCorrectionRequest();
  const rejectRequest = useRejectTimeCorrectionRequest();
  const requestClarification = useRequestClarification();
  
  const [actionDialog, setActionDialog] = useState<{
    type: 'reject' | 'clarify' | null;
    request: TimeCorrectionRequest | null;
  }>({ type: null, request: null });
  const [notes, setNotes] = useState('');

  const handleApprove = (request: TimeCorrectionRequest) => {
    approveRequest.mutate({ id: request.id });
  };

  const handleAction = () => {
    if (!actionDialog.request || !actionDialog.type) return;
    
    if (actionDialog.type === 'reject') {
      rejectRequest.mutate({ id: actionDialog.request.id, review_notes: notes });
    } else {
      requestClarification.mutate({ id: actionDialog.request.id, review_notes: notes });
    }
    
    setActionDialog({ type: null, request: null });
    setNotes('');
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">No pending correction requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Time Correction Requests
            <Badge variant="secondary">{requests.length}</Badge>
          </CardTitle>
          <CardDescription>Review and approve time correction requests from your team</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Requested Time</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.employee?.first_name} {request.employee?.last_name}
                    <div className="text-xs text-muted-foreground">
                      {request.employee?.employee_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.correction_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {request.requested_clock_in && request.requested_clock_out ? (
                      <>
                        {format(new Date(request.requested_clock_in), 'h:mm a')} - {' '}
                        {format(new Date(request.requested_clock_out), 'h:mm a')}
                      </>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm" title={request.reason}>
                      {request.reason}
                    </p>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(request)}
                        disabled={approveRequest.isPending}
                        title="Approve"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActionDialog({ type: 'reject', request })}
                        title="Reject"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActionDialog({ type: 'clarify', request })}
                        title="Request Clarification"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog 
        open={!!actionDialog.type} 
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog({ type: null, request: null });
            setNotes('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'reject' ? 'Reject Request' : 'Request Clarification'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'reject' 
                ? 'Provide a reason for rejecting this correction request.' 
                : 'Ask the employee for additional information.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="notes">
              {actionDialog.type === 'reject' ? 'Rejection Reason' : 'Clarification Request'} *
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                actionDialog.type === 'reject' 
                  ? 'Explain why this request is being rejected...'
                  : 'What additional information do you need?'
              }
              className="mt-2"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, request: null })}>
              Cancel
            </Button>
            <Button
              variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={!notes.trim() || rejectRequest.isPending || requestClarification.isPending}
            >
              {actionDialog.type === 'reject' ? 'Reject' : 'Request Clarification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
