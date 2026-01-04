import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, TrendingUp } from 'lucide-react';
import { useDepartments } from '@/hooks/useDepartments';
import { useCreatePromotion } from '@/hooks/useEmploymentHistory';
import { useLocalization, CURRENCY_CONFIG } from '@/contexts/LocalizationContext';
import type { Employee } from '@/hooks/useEmployees';

const promotionSchema = z.object({
  new_job_title: z.string().min(1, 'New job title is required'),
  new_department_id: z.string().optional(),
  effective_from: z.string().min(1, 'Effective date is required'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  include_salary_increase: z.boolean().default(false),
  salary_increase: z.coerce.number().optional(),
  salary_currency: z.string().optional(),
});

type PromotionFormValues = z.infer<typeof promotionSchema>;

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

export function PromotionDialog({ open, onOpenChange, employee }: PromotionDialogProps) {
  const { data: departments } = useDepartments();
  const createPromotion = useCreatePromotion();
  const { settings } = useLocalization();

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      new_job_title: employee.job_title || '',
      new_department_id: employee.department_id || '',
      effective_from: new Date().toISOString().split('T')[0],
      reason: '',
      notes: '',
      include_salary_increase: false,
      salary_increase: undefined,
      salary_currency: settings.currency,
    },
  });

  const includeSalary = form.watch('include_salary_increase');

  const onSubmit = async (values: PromotionFormValues) => {
    await createPromotion.mutateAsync({
      employee_id: employee.id,
      new_job_title: values.new_job_title,
      new_department_id: values.new_department_id || null,
      effective_from: values.effective_from,
      reason: values.reason,
      notes: values.notes,
      salary_increase: values.include_salary_increase ? values.salary_increase : undefined,
      salary_currency: values.salary_currency,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Promote Employee
          </DialogTitle>
          <DialogDescription>
            Promote {employee.first_name} {employee.last_name} to a new position
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Job Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Senior Software Engineer" {...field} />
                  </FormControl>
                  <FormDescription>Current: {employee.job_title || 'Not set'}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="new_department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
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
              name="effective_from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Promotion</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Performance, Tenure, Skill development" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this promotion..."
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4 space-y-4">
              <FormField
                control={form.control}
                name="include_salary_increase"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Include Salary Increase</FormLabel>
                      <FormDescription>Add a salary adjustment with this promotion</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {includeSalary && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salary_increase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Increase Amount</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 5000"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salary_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || settings.currency}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                              <SelectItem key={code} value={code}>
                                {code} ({config.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPromotion.isPending}>
                {createPromotion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Promotion
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
