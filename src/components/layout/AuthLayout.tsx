import { ReactNode } from 'react';
import { AppFooter } from './AppFooter';
import { usePlatformFooter } from '@/hooks/usePlatformFooter';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { showFooter } = usePlatformFooter();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {children}
      </div>
      <AppFooter showFooter={showFooter} />
    </div>
  );
}
