import { useMemo } from 'react';

interface UseBaseDomainResult {
  baseDomain: string;
  isLocalhost: boolean;
  isLovable: boolean;
  isCustomDomain: boolean;
}

export function useBaseDomain(): UseBaseDomainResult {
  return useMemo(() => {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Development mode
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return {
        baseDomain: port ? `${hostname}:${port}` : hostname,
        isLocalhost: true,
        isLovable: false,
        isCustomDomain: false,
      };
    }

    // Running on Lovable
    if (hostname.endsWith('.lovable.app')) {
      return {
        baseDomain: hostname,
        isLocalhost: false,
        isLovable: true,
        isCustomDomain: false,
      };
    }

    // Running on custom domain
    return {
      baseDomain: hostname,
      isLocalhost: false,
      isLovable: false,
      isCustomDomain: true,
    };
  }, []);
}
