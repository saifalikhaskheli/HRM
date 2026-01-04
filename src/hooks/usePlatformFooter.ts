import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PlatformFooterSettings {
  showFooter: boolean;
}

export function usePlatformFooter(): PlatformFooterSettings & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-footer-settings'],
    queryFn: async () => {
      // Try to fetch the platform setting for footer visibility
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'show_platform_footer')
        .maybeSingle();

      if (error) {
        // Table might not exist or no permission - default to showing footer
        console.warn('Could not fetch platform footer setting:', error.message);
        return { showFooter: true };
      }

      // If setting exists, parse the value
      if (data?.value !== undefined) {
        // Handle both boolean and string values
        const value = data.value;
        if (typeof value === 'boolean') {
          return { showFooter: value };
        }
        if (typeof value === 'string') {
          return { showFooter: value === 'true' };
        }
        if (typeof value === 'object' && value !== null && 'enabled' in value) {
          return { showFooter: Boolean((value as { enabled: boolean }).enabled) };
        }
      }

      // Default to showing footer
      return { showFooter: true };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false,
  });

  return {
    showFooter: data?.showFooter ?? true,
    isLoading,
  };
}
