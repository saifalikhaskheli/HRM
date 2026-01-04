import { format } from 'date-fns';
import { CheckCircle2, Clock, FileEdit, UserCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { PerformanceReview } from '@/hooks/usePerformance';

interface ReviewLifecycleCardProps {
  review: PerformanceReview & {
    employee?: { first_name: string; last_name: string; job_title?: string | null } | null;
    reviewer?: { first_name: string; last_name: string } | null;
  };
  onStartSelfReview?: () => void;
  onStartManagerReview?: () => void;
  onAcknowledge?: () => void;
  isEmployee?: boolean;
  isReviewer?: boolean;
}

type LifecycleState = 'pending_self_review' | 'pending_manager_review' | 'pending_acknowledgement' | 'completed';

const lifecycleSteps = [
  { key: 'pending_self_review', label: 'Self Review', icon: FileEdit },
  { key: 'pending_manager_review', label: 'Manager Review', icon: UserCheck },
  { key: 'pending_acknowledgement', label: 'Acknowledgement', icon: CheckCircle2 },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
] as const;

function getLifecycleProgress(state: string | null): number {
  switch (state) {
    case 'pending_self_review': return 0;
    case 'pending_manager_review': return 33;
    case 'pending_acknowledgement': return 66;
    case 'completed': return 100;
    default: return 0;
  }
}

function getStepStatus(stepKey: string, currentState: string | null): 'completed' | 'current' | 'pending' {
  const steps = ['pending_self_review', 'pending_manager_review', 'pending_acknowledgement', 'completed'];
  const currentIndex = steps.indexOf(currentState || 'pending_self_review');
  const stepIndex = steps.indexOf(stepKey);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'pending';
}

export function ReviewLifecycleCard({
  review,
  onStartSelfReview,
  onStartManagerReview,
  onAcknowledge,
  isEmployee = false,
  isReviewer = false,
}: ReviewLifecycleCardProps) {
  const lifecycleState = (review as any).lifecycle_state || 'pending_self_review';
  const progress = getLifecycleProgress(lifecycleState);

  const showSelfReviewButton = isEmployee && lifecycleState === 'pending_self_review';
  const showManagerReviewButton = isReviewer && lifecycleState === 'pending_manager_review';
  const showAcknowledgeButton = isEmployee && lifecycleState === 'pending_acknowledgement';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {review.employee?.first_name} {review.employee?.last_name}
            </CardTitle>
            <CardDescription>
              {review.employee?.job_title} • {review.review_type || 'Annual'} Review
            </CardDescription>
          </div>
          <Badge variant={
            lifecycleState === 'completed' ? 'default' :
            lifecycleState === 'pending_acknowledgement' ? 'secondary' :
            'outline'
          }>
            {lifecycleState.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Review Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Lifecycle Steps */}
        <div className="flex items-center justify-between">
          {lifecycleSteps.map((step, index) => {
            const status = getStepStatus(step.key, lifecycleState);
            const Icon = step.icon;
            
            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div className={`
                  h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-colors
                  ${status === 'completed' ? 'bg-green-500 text-white' : ''}
                  ${status === 'current' ? 'bg-primary text-primary-foreground' : ''}
                  ${status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-xs font-medium ${
                  status === 'pending' ? 'text-muted-foreground' : ''
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Period Info */}
        <div className="flex items-center justify-between text-sm border-t pt-4">
          <div>
            <span className="text-muted-foreground">Review Period: </span>
            <span className="font-medium">
              {format(new Date(review.review_period_start), 'MMM yyyy')} - {format(new Date(review.review_period_end), 'MMM yyyy')}
            </span>
          </div>
          {review.reviewer && (
            <div>
              <span className="text-muted-foreground">Reviewer: </span>
              <span className="font-medium">
                {review.reviewer.first_name} {review.reviewer.last_name}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {(showSelfReviewButton || showManagerReviewButton || showAcknowledgeButton) && (
          <div className="flex justify-end gap-2 border-t pt-4">
            {showSelfReviewButton && onStartSelfReview && (
              <Button onClick={onStartSelfReview}>
                <FileEdit className="h-4 w-4 mr-2" />
                Complete Self Review
              </Button>
            )}
            {showManagerReviewButton && onStartManagerReview && (
              <Button onClick={onStartManagerReview}>
                <UserCheck className="h-4 w-4 mr-2" />
                Complete Manager Review
              </Button>
            )}
            {showAcknowledgeButton && onAcknowledge && (
              <Button onClick={onAcknowledge}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Acknowledge Review
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
