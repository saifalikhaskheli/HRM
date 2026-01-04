import { Badge } from '@/components/ui/badge';
import { Enums } from '@/integrations/supabase/types';

type CandidateStatus = Enums<'candidate_status'>;

interface Props {
  status: CandidateStatus;
}

const statusConfig: Record<CandidateStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  applied: { label: 'Applied', variant: 'secondary' },
  screening: { label: 'Screening', variant: 'outline', className: 'border-purple-500 text-purple-600' },
  interviewing: { label: 'Interviewing', variant: 'outline', className: 'border-amber-500 text-amber-600' },
  offered: { label: 'Offered', variant: 'outline', className: 'border-cyan-500 text-cyan-600' },
  hired: { label: 'Hired', variant: 'default', className: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', variant: 'outline' },
};

export function CandidateStatusBadge({ status }: Props) {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
