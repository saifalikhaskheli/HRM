import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateReview, useSubmitReview, useReview } from '@/hooks/usePerformance';
import { useEmployees } from '@/hooks/useEmployees';

const createSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  reviewer_id: z.string().min(1, 'Reviewer is required'),
  review_period_start: z.string().min(1, 'Start date is required'),
  review_period_end: z.string().min(1, 'End date is required'),
  review_type: z.string().default('annual'),
});

const completeSchema = z.object({
  overall_rating: z.number().min(1).max(5),
  manager_assessment: z.string().min(10, 'Assessment must be at least 10 characters').max(5000),
  strengths: z.string().max(2000).optional(),
  areas_for_improvement: z.string().max(2000).optional(),
  development_plan: z.string().max(2000).optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type CompleteFormValues = z.infer<typeof completeSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'complete';
  reviewId?: string | null;
}

export function ReviewFormDialog({ open, onOpenChange, mode, reviewId }: Props) {
  const { data: employees = [] } = useEmployees();
  const { data: review } = useReview(mode === 'complete' ? reviewId : null);
  const createReview = useCreateReview();
  const submitReview = useSubmitReview();

  const isPending = createReview.isPending || submitReview.isPending;

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      employee_id: '',
      reviewer_id: '',
      review_period_start: '',
      review_period_end: '',
      review_type: 'annual',
    },
  });

  const completeForm = useForm<CompleteFormValues>({
    resolver: zodResolver(completeSchema),
    defaultValues: {
      overall_rating: 3,
      manager_assessment: '',
      strengths: '',
      areas_for_improvement: '',
      development_plan: '',
    },
  });

  useEffect(() => {
    if (review && mode === 'complete') {
      completeForm.reset({
        overall_rating: review.overall_rating || 3,
        manager_assessment: review.manager_assessment || '',
        strengths: review.strengths || '',
        areas_for_improvement: review.areas_for_improvement || '',
        development_plan: review.development_plan || '',
      });
    }
  }, [review, mode, completeForm]);

  const onCreateSubmit = async (values: CreateFormValues) => {
    await createReview.mutateAsync({
      employee_id: values.employee_id,
      reviewer_id: values.reviewer_id,
      review_period_start: values.review_period_start,
      review_period_end: values.review_period_end,
      review_type: values.review_type,
    });
    createForm.reset();
    onOpenChange(false);
  };

  const onCompleteSubmit = async (values: CompleteFormValues) => {
    if (!reviewId) return;
    await submitReview.mutateAsync({
      id: reviewId,
      overall_rating: values.overall_rating,
      manager_assessment: values.manager_assessment,
      strengths: values.strengths,
      areas_for_improvement: values.areas_for_improvement,
      development_plan: values.development_plan,
    });
    completeForm.reset();
    onOpenChange(false);
  };

  if (mode === 'create') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start Review Cycle</DialogTitle>
            <DialogDescription>Create a new performance review for an employee</DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
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
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} - {emp.job_title || 'No title'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="reviewer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reviewer (Manager)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reviewer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((emp) => (
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="review_period_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="review_period_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="review_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="annual">Annual Review</SelectItem>
                        <SelectItem value="mid_year">Mid-Year Review</SelectItem>
                        <SelectItem value="quarterly">Quarterly Review</SelectItem>
                        <SelectItem value="probation">Probation Review</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Review
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // Complete Review Form
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Performance Review</DialogTitle>
          {review && (
            <DialogDescription>
              Reviewing {(review.employee as any)?.first_name} {(review.employee as any)?.last_name} for{' '}
              {format(new Date(review.review_period_start), 'MMM yyyy')} - {format(new Date(review.review_period_end), 'MMM yyyy')}
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...completeForm}>
          <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-6">
            <FormField
              control={completeForm.control}
              name="overall_rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Rating</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => field.onChange(rating)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-8 w-8 transition-colors ${
                              rating <= field.value
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-lg font-medium">{field.value} / 5</span>
                    </div>
                  </FormControl>
                  <FormDescription>Rate the employee's overall performance</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={completeForm.control}
              name="manager_assessment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manager Assessment *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a comprehensive assessment of the employee's performance during this review period..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={completeForm.control}
              name="strengths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Strengths</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What are the employee's key strengths and accomplishments?"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={completeForm.control}
              name="areas_for_improvement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Areas for Improvement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What areas should the employee focus on improving?"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={completeForm.control}
              name="development_plan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Development Plan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Outline goals and development objectives for the next period..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Save Draft
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Review
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
