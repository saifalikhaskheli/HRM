import { Badge } from '@/components/ui/badge';
import { Enums } from '@/integrations/supabase/types';
import { Clock, FileEdit, CheckCircle2, CheckCheck } from 'lucide-react';

type ReviewStatus = Enums<'review_status'>;

interface Props {
  status: ReviewStatus;
}

const statusConfig: Record<ReviewStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  draft: { 
    label: 'Draft', 
    variant: 'secondary',
    icon: Clock,
  },
  in_progress: { 
    label: 'In Progress', 
    variant: 'outline', 
    className: 'border-amber-500 text-amber-600',
    icon: FileEdit,
  },
  completed: { 
    label: 'Completed', 
    variant: 'outline', 
    className: 'border-green-500 text-green-600',
    icon: CheckCircle2,
  },
  acknowledged: { 
    label: 'Acknowledged', 
    variant: 'default', 
    className: 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
    icon: CheckCheck,
  },
};

export function ReviewStatusBadge({ status }: Props) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
