import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { PayrollStatus, payrollStatusConfig } from '@/types/payroll';

const statusIcons: Record<PayrollStatus, typeof FileText> = {
  draft: FileText,
  processing: Clock,
  completed: CheckCircle,
  failed: AlertCircle,
};

interface PayrollStatusBadgeProps {
  status: PayrollStatus;
}

export function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  const config = payrollStatusConfig[status];
  const Icon = statusIcons[status];
  
  return (
    <Badge className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
