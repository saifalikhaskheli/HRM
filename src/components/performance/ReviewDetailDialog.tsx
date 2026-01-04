import { useState } from 'react';
import { format } from 'date-fns';
import { Star, User, Calendar, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useReview, useAcknowledgeReview } from '@/hooks/usePerformance';
import { useTenant } from '@/contexts/TenantContext';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { WriteGate } from '@/components/PermissionGate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string | null;
}

export function ReviewDetailDialog({ open, onOpenChange, reviewId }: Props) {
  const { employeeId } = useTenant();
  const { data: review, isLoading } = useReview(reviewId);
  const acknowledgeReview = useAcknowledgeReview();
  const [employeeComments, setEmployeeComments] = useState('');

  if (!review) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Review not found</div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const isOwnReview = review.employee_id === employeeId;
  const canAcknowledge = isOwnReview && review.status === 'completed';

  const handleAcknowledge = async () => {
    await acknowledgeReview.mutateAsync({
      id: review.id,
      employee_comments: employeeComments || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Performance Review</DialogTitle>
            <ReviewStatusBadge status={review.status} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employee</p>
                    <p className="font-medium">
                      {(review.employee as any)?.first_name} {(review.employee as any)?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{(review.employee as any)?.job_title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Review Period</p>
                    <p className="font-medium">
                      {format(new Date(review.review_period_start), 'MMM yyyy')} - {format(new Date(review.review_period_end), 'MMM yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">{review.review_type || 'Annual'} Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rating */}
          {review.overall_rating && (
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Overall Rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-8 w-8 ${
                        star <= review.overall_rating!
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-2xl font-bold">{review.overall_rating} / 5</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Assessment */}
          {review.manager_assessment && (
            <div>
              <h4 className="font-medium mb-2">Manager Assessment</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.manager_assessment}</p>
            </div>
          )}

          {/* Strengths */}
          {review.strengths && (
            <div>
              <h4 className="font-medium mb-2">Key Strengths</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.strengths}</p>
            </div>
          )}

          {/* Areas for Improvement */}
          {review.areas_for_improvement && (
            <div>
              <h4 className="font-medium mb-2">Areas for Improvement</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.areas_for_improvement}</p>
            </div>
          )}

          {/* Development Plan */}
          {review.development_plan && (
            <div>
              <h4 className="font-medium mb-2">Development Plan</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.development_plan}</p>
            </div>
          )}

          {/* Employee Comments (if acknowledged) */}
          {review.employee_comments && (
            <div>
              <h4 className="font-medium mb-2">Employee Comments</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.employee_comments}</p>
            </div>
          )}

          {/* Acknowledge Section */}
          {canAcknowledge && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label>Your Comments (Optional)</Label>
                  <Textarea
                    placeholder="Add any comments or feedback about this review..."
                    value={employeeComments}
                    onChange={(e) => setEmployeeComments(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <WriteGate>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Review Later
                    </Button>
                    <Button onClick={handleAcknowledge} disabled={acknowledgeReview.isPending}>
                      {acknowledgeReview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Acknowledge Review
                    </Button>
                  </div>
                </WriteGate>
              </div>
            </>
          )}

          {/* Acknowledgment Info */}
          {review.status === 'acknowledged' && review.acknowledged_at && (
            <div className="text-center text-sm text-muted-foreground">
              Acknowledged on {format(new Date(review.acknowledged_at), 'MMMM d, yyyy')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
