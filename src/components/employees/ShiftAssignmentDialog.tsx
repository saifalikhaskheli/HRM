import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useActiveShifts, useAssignShift, useEndShiftAssignment, useCurrentEmployeeShift } from '@/hooks/useShifts';
import { format } from 'date-fns';

interface ShiftAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

export function ShiftAssignmentDialog({ 
  open, 
  onOpenChange, 
  employeeId,
  employeeName 
}: ShiftAssignmentDialogProps) {
  const { data: shifts } = useActiveShifts();
  const { data: currentAssignment } = useCurrentEmployeeShift(employeeId);
  const assignShift = useAssignShift();
  const endAssignment = useEndShiftAssignment();
  
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [reason, setReason] = useState('');
  
  const isLoading = assignShift.isPending || endAssignment.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shiftId) return;

    try {
      // End current assignment if exists and new one starts on or before today
      if (currentAssignment && effectiveFrom <= new Date().toISOString().split('T')[0]) {
        const endDate = new Date(effectiveFrom);
        endDate.setDate(endDate.getDate() - 1);
        await endAssignment.mutateAsync({
          assignmentId: currentAssignment.id,
          endDate: endDate.toISOString().split('T')[0],
        });
      }

      await assignShift.mutateAsync({
        employee_id: employeeId,
        shift_id: shiftId,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_temporary: isTemporary,
        reason: reason || null,
      });
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const resetForm = () => {
    setShiftId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setIsTemporary(false);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Shift</DialogTitle>
          <DialogDescription>
            Assign a new shift to {employeeName}
          </DialogDescription>
        </DialogHeader>

        {currentAssignment && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Current Shift</p>
            <p className="text-muted-foreground">
              {currentAssignment.shift.name} ({format(new Date(`2000-01-01T${currentAssignment.shift.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${currentAssignment.shift.end_time}`), 'h:mm a')})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Since {format(new Date(currentAssignment.effective_from), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shift">New Shift *</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shifts?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({format(new Date(`2000-01-01T${shift.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${shift.end_time}`), 'h:mm a')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effective_from">Effective From *</Label>
              <Input
                id="effective_from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_to">Effective To</Label>
              <Input
                id="effective_to"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                min={effectiveFrom}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="temporary">Temporary Assignment</Label>
              <p className="text-xs text-muted-foreground">
                Mark if this is a temporary shift change
              </p>
            </div>
            <Switch
              id="temporary"
              checked={isTemporary}
              onCheckedChange={setIsTemporary}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Project requirement, shift rotation..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!shiftId || isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
