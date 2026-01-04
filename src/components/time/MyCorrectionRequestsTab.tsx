import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMyTimeCorrectionRequests } from '@/hooks/useTimeCorrectionRequests';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  clarification_needed: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  clarification_needed: 'Needs Clarification',
};

export function MyCorrectionRequestsTab() {
  const { data: requests = [], isLoading } = useMyTimeCorrectionRequests();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No correction requests</p>
          <p className="text-sm text-muted-foreground mt-1">
            You haven't submitted any time correction requests yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Correction Requests</CardTitle>
        <CardDescription>Track the status of your time correction requests</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Requested Time</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {format(new Date(request.correction_date), 'EEE, MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {request.requested_clock_in ? format(new Date(request.requested_clock_in), 'h:mm a') : '-'}
                      {request.requested_clock_out && ` → ${format(new Date(request.requested_clock_out), 'h:mm a')}`}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm truncate" title={request.reason}>
                      {request.reason}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[request.status]}>
                      {statusLabels[request.status] || request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {request.review_notes ? (
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          View response
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">{request.review_notes}</p>
                          {request.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(request.reviewed_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
