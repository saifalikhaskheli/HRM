import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useCreateGoal, useUpdateGoal } from '@/hooks/useGoals';

const goalSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  target_date: z.string().min(1, 'Target date is required'),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['not_started', 'in_progress', 'completed', 'cancelled']),
  progress: z.number().min(0).max(100),
});

type GoalFormValues = z.infer<typeof goalSchema>;

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: {
    id: string;
    employee_id: string;
    title: string;
    description?: string | null;
    target_date: string;
    priority: string;
    status: string;
    progress: number;
  } | null;
}

export function GoalFormDialog({ open, onOpenChange, goal }: GoalFormDialogProps) {
  const { data: employees } = useEmployees();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  
  const isEditing = !!goal;
  
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      employee_id: '',
      title: '',
      description: '',
      target_date: '',
      priority: 'medium',
      status: 'not_started',
      progress: 0,
    },
  });

  useEffect(() => {
    if (goal) {
      form.reset({
        employee_id: goal.employee_id,
        title: goal.title,
        description: goal.description || '',
        target_date: goal.target_date,
        priority: goal.priority as 'low' | 'medium' | 'high',
        status: goal.status as 'not_started' | 'in_progress' | 'completed' | 'cancelled',
        progress: goal.progress,
      });
    } else {
      form.reset({
        employee_id: '',
        title: '',
        description: '',
        target_date: '',
        priority: 'medium',
        status: 'not_started',
        progress: 0,
      });
    }
  }, [goal, form]);

  const onSubmit = async (values: GoalFormValues) => {
    try {
      const goalData = {
        employee_id: values.employee_id,
        title: values.title,
        description: values.description,
        target_date: values.target_date,
        priority: values.priority as string,
        status: values.status as string,
        progress: values.progress,
      };
      
      if (isEditing && goal) {
        await updateGoal.mutateAsync({ 
          id: goal.id, 
          ...goalData,
        });
      } else {
        await createGoal.mutateAsync(goalData);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  const isPending = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Goal' : 'Add New Goal'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees?.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Complete project milestone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Auto-adjust progress based on status
                      if (value === 'not_started') {
                        form.setValue('progress', 0);
                      } else if (value === 'completed') {
                        form.setValue('progress', 100);
                      }
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => {
                const status = form.watch('status');
                const isEditable = status === 'in_progress';
                return (
                  <FormItem>
                    <FormLabel>Progress ({field.value}%)</FormLabel>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={([value]) => {
                          field.onChange(value);
                          // Auto-update status based on progress
                          if (value === 100 && status !== 'completed') {
                            form.setValue('status', 'completed');
                          } else if (value === 0 && status !== 'not_started' && status !== 'cancelled') {
                            form.setValue('status', 'not_started');
                          } else if (value > 0 && value < 100 && status !== 'in_progress' && status !== 'cancelled') {
                            form.setValue('status', 'in_progress');
                          }
                        }}
                        max={100}
                        step={5}
                        disabled={!isEditable && status !== 'not_started'}
                        className={!isEditable && status !== 'not_started' ? 'opacity-50' : ''}
                      />
                    </FormControl>
                    {!isEditable && status !== 'not_started' && (
                      <p className="text-xs text-muted-foreground">
                        Progress is fixed for {status === 'completed' ? 'completed' : 'cancelled'} goals
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Goal' : 'Create Goal'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}