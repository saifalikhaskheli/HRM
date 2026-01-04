import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`p-4 md:p-6 space-y-6 ${className}`}>
      {children}
    </div>
  );
}
