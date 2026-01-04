import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Edit } from 'lucide-react';
import { useCreateTimeCorrectionRequest } from '@/hooks/useTimeCorrectionRequests';

interface TimeCorrectionDialogProps {
  trigger?: React.ReactNode;
}

export function TimeCorrectionDialog({ trigger }: TimeCorrectionDialogProps) {
  const [open, setOpen] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [reason, setReason] = useState('');

  const createRequest = useCreateTimeCorrectionRequest();

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Reason is required for time corrections');
      return;
    }

    const clockInTime = new Date(`${date}T${clockIn}:00`);
    const clockOutTime = new Date(`${date}T${clockOut}:00`);
    
    if (clockOutTime <= clockInTime) {
      toast.error('Clock out must be after clock in');
      return;
    }

    createRequest.mutate(
      {
        correction_date: date,
        requested_clock_in: clockInTime.toISOString(),
        requested_clock_out: clockOutTime.toISOString(),
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setReason('');
          setDate(new Date().toISOString().split('T')[0]);
          setClockIn('09:00');
          setClockOut('17:00');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Request Time Correction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Time Correction</DialogTitle>
          <DialogDescription>
            Submit a time correction request for approval by your manager. 
            Your original time entry will remain unchanged until approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clockIn">Clock In</Label>
              <Input
                id="clockIn"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clockOut">Clock Out</Label>
              <Input
                id="clockOut"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Correction *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this correction is needed..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Your request will be sent for manager/HR approval before any changes are made.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createRequest.isPending || !reason.trim()}
          >
            {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
