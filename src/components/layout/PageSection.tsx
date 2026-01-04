import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageSection({ 
  children, 
  title, 
  description, 
  actions,
  className = '',
  noPadding = false 
}: PageSectionProps) {
  if (!title) {
    return (
      <Card className={className}>
        <CardContent className={noPadding ? 'p-0' : 'pt-6'}>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={noPadding ? 'p-0 pt-0' : ''}>
        {children}
      </CardContent>
    </Card>
  );
}
