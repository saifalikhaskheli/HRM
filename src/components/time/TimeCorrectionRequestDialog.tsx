import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Clock, AlertTriangle, Info } from 'lucide-react';
import { useCreateTimeCorrectionRequest } from '@/hooks/useTimeCorrectionRequests';
import { format } from 'date-fns';

const correctionSchema = z.object({
  correction_date: z.string().min(1, 'Date is required'),
  requested_clock_in: z.string().optional(),
  requested_clock_out: z.string().optional(),
  requested_break_minutes: z.coerce.number().min(0).default(0),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)'),
}).refine(data => data.requested_clock_in || data.requested_clock_out, {
  message: 'Please provide at least clock in or clock out time',
  path: ['requested_clock_in'],
});

type CorrectionFormValues = z.infer<typeof correctionSchema>;

interface TimeCorrectionRequestDialogProps {
  trigger?: React.ReactNode;
  defaultDate?: string;
}

export function TimeCorrectionRequestDialog({ trigger, defaultDate }: TimeCorrectionRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const createRequest = useCreateTimeCorrectionRequest();

  const form = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      correction_date: defaultDate || format(new Date(), 'yyyy-MM-dd'),
      requested_clock_in: '',
      requested_clock_out: '',
      requested_break_minutes: 0,
      reason: '',
    },
  });

  const onSubmit = async (values: CorrectionFormValues) => {
    const date = values.correction_date;
    
    // Convert time strings to full ISO datetime
    const clockIn = values.requested_clock_in 
      ? new Date(`${date}T${values.requested_clock_in}:00`).toISOString()
      : null;
    const clockOut = values.requested_clock_out
      ? new Date(`${date}T${values.requested_clock_out}:00`).toISOString()
      : null;

    await createRequest.mutateAsync({
      correction_date: date,
      requested_clock_in: clockIn,
      requested_clock_out: clockOut,
      requested_break_minutes: values.requested_break_minutes,
      reason: values.reason,
    });
    
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Clock className="h-4 w-4 mr-2" />
            Request Time Correction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Time Correction</DialogTitle>
          <DialogDescription>
            Submit a request to correct your time entry. This will require approval from HR.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your original time entry will be preserved. Corrections are tracked separately for audit purposes.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="correction_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} max={format(new Date(), 'yyyy-MM-dd')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requested_clock_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct Clock In</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requested_clock_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct Clock Out</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requested_break_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Break Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormDescription>Total break time in minutes</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Correction *</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Please explain why this correction is needed (e.g., forgot to clock in, system error, etc.)"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRequest.isPending}>
                {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
