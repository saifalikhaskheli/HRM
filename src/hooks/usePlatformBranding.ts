import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface BrandingSettings {
  logo_url: string | null;
  primary_color: string;
  platform_name: string;
}

const defaultBranding: BrandingSettings = {
  logo_url: null,
  primary_color: '#3b82f6',
  platform_name: 'HR Platform',
};

export function usePlatformBranding() {
  const { data: branding, isLoading } = useQuery({
    queryKey: ['platform-branding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'branding')
        .maybeSingle();

      if (error) {
        console.error('Error fetching platform branding:', error);
        return defaultBranding;
      }

      const value = data?.value as unknown;
      if (value && typeof value === 'object' && 'platform_name' in value) {
        return value as BrandingSettings;
      }
      return defaultBranding;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Apply primary color as CSS variable
  useEffect(() => {
    if (branding?.primary_color) {
      // Convert hex to HSL for CSS variable
      const hex = branding.primary_color;
      const hsl = hexToHSL(hex);
      if (hsl) {
        document.documentElement.style.setProperty('--platform-primary', hsl);
      }
    }
  }, [branding?.primary_color]);

  return {
    branding: branding || defaultBranding,
    isLoading,
    platformName: branding?.platform_name || defaultBranding.platform_name,
    logoUrl: branding?.logo_url,
    primaryColor: branding?.primary_color || defaultBranding.primary_color,
  };
}

// Helper function to convert hex to HSL
function hexToHSL(hex: string): string | null {
  try {
    // Remove the hash if present
    hex = hex.replace(/^#/, '');

    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return null;
  }
}
