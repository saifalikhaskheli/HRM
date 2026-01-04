import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useUpdateGoalProgress } from '@/hooks/useGoals';
import type { Goal } from '@/hooks/useGoals';

const formSchema = z.object({
  progress: z.number().min(0).max(100),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GoalProgressDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalProgressDialog({ goal, open, onOpenChange }: GoalProgressDialogProps) {
  const updateProgress = useUpdateGoalProgress();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      progress: goal?.progress || 0,
      notes: '',
    },
  });

  const currentProgress = form.watch('progress');

  const onSubmit = async (data: FormValues) => {
    if (!goal) return;

    await updateProgress.mutateAsync({
      id: goal.id,
      progress: data.progress,
      note: data.notes || undefined,
    });

    onOpenChange(false);
  };

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Update Progress
          </DialogTitle>
          <DialogDescription>
            Update the progress for "{goal.title}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Progress Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Current Progress</span>
                <span className="font-medium">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} className="h-2" />
            </div>

            {/* New Progress Slider */}
            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>New Progress</FormLabel>
                    <span className="text-2xl font-bold text-primary">{field.value}%</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      min={0}
                      max={100}
                      step={5}
                      className="py-4"
                    />
                  </FormControl>
                  <FormDescription>
                    Drag the slider to update progress. 
                    {currentProgress === 100 && " Setting to 100% will mark the goal as completed."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Progress Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what was accomplished, challenges faced, etc."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProgress.isPending}>
                {updateProgress.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Progress
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
