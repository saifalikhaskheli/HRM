import { useEffect, useState } from 'react';
import { useCompanySetting } from '@/hooks/useCompanySettings';

export interface AppearanceSettings {
  accentColor: string;
  compactMode: boolean;
  fontSize: 'small' | 'default' | 'large';
  borderRadius: 'none' | 'small' | 'default' | 'large';
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  accentColor: 'default',
  compactMode: false,
  fontSize: 'default',
  borderRadius: 'default',
};

// HSL color values for accent colors (for both light and dark modes)
const ACCENT_COLORS: Record<string, { light: { primary: string; ring: string }; dark: { primary: string; ring: string } }> = {
  default: {
    light: { primary: '222.2 47.4% 11.2%', ring: '222.2 84% 4.9%' },
    dark: { primary: '210 40% 98%', ring: '212.7 26.8% 83.9%' },
  },
  rose: {
    light: { primary: '346.8 77.2% 49.8%', ring: '346.8 77.2% 49.8%' },
    dark: { primary: '346.8 77.2% 59.8%', ring: '346.8 77.2% 59.8%' },
  },
  orange: {
    light: { primary: '24.6 95% 53.1%', ring: '24.6 95% 53.1%' },
    dark: { primary: '20.5 90.2% 58.2%', ring: '20.5 90.2% 58.2%' },
  },
  green: {
    light: { primary: '142.1 76.2% 36.3%', ring: '142.1 76.2% 36.3%' },
    dark: { primary: '142.1 70.6% 45.3%', ring: '142.1 70.6% 45.3%' },
  },
  purple: {
    light: { primary: '262.1 83.3% 57.8%', ring: '262.1 83.3% 57.8%' },
    dark: { primary: '263.4 70% 50.4%', ring: '263.4 70% 50.4%' },
  },
  cyan: {
    light: { primary: '192 91% 36%', ring: '192 91% 36%' },
    dark: { primary: '186 94% 45%', ring: '186 94% 45%' },
  },
  blue: {
    light: { primary: '221.2 83.2% 53.3%', ring: '221.2 83.2% 53.3%' },
    dark: { primary: '217.2 91.2% 59.8%', ring: '217.2 91.2% 59.8%' },
  },
  pink: {
    light: { primary: '330.4 81.2% 60.4%', ring: '330.4 81.2% 60.4%' },
    dark: { primary: '330.4 81.2% 65.4%', ring: '330.4 81.2% 65.4%' },
  },
};

const FONT_SIZE_MAP = {
  small: '14px',
  default: '16px',
  large: '18px',
};

const BORDER_RADIUS_MAP = {
  none: '0',
  small: '0.25rem',
  default: '0.5rem',
  large: '0.75rem',
};

function applyAccentColor(colorName: string) {
  const colors = ACCENT_COLORS[colorName] || ACCENT_COLORS.default;
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  
  const colorSet = isDark ? colors.dark : colors.light;
  
  root.style.setProperty('--primary', colorSet.primary);
  root.style.setProperty('--ring', colorSet.ring);
  root.style.setProperty('--sidebar-primary', colorSet.primary);
}

function applyCompactMode(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('compact');
  } else {
    root.classList.remove('compact');
  }
}

function applyFontSize(size: 'small' | 'default' | 'large') {
  document.documentElement.style.setProperty('--base-font-size', FONT_SIZE_MAP[size]);
}

function applyBorderRadius(radius: 'none' | 'small' | 'default' | 'large') {
  document.documentElement.style.setProperty('--radius', BORDER_RADIUS_MAP[radius]);
}

export type AccentColor = keyof typeof ACCENT_COLORS;

export function useAppearance() {
  const { data: savedSettings, isLoading } = useCompanySetting('appearance');
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS);

  // Load and apply settings
  useEffect(() => {
    // First try localStorage for immediate effect, then override with DB
    const localAccent = localStorage.getItem('accent-color');
    const localCompact = localStorage.getItem('compact-mode') === 'true';
    
    if (localAccent) {
      applyAccentColor(localAccent);
    }
    if (localCompact) {
      applyCompactMode(localCompact);
    }
  }, []);

  useEffect(() => {
    if (savedSettings?.value) {
      const saved = savedSettings.value as unknown as Partial<AppearanceSettings>;
      const merged = { ...DEFAULT_SETTINGS, ...saved };
      setSettings(merged);
      
      applyAccentColor(merged.accentColor);
      applyCompactMode(merged.compactMode);
      applyFontSize(merged.fontSize);
      applyBorderRadius(merged.borderRadius);
    }
  }, [savedSettings]);

  // Re-apply accent when theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          applyAccentColor(settings.accentColor);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [settings.accentColor]);

  const updateAccentColor = (color: string) => {
    setSettings(prev => ({ ...prev, accentColor: color }));
    localStorage.setItem('accent-color', color);
    applyAccentColor(color);
  };

  const updateCompactMode = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, compactMode: enabled }));
    localStorage.setItem('compact-mode', String(enabled));
    applyCompactMode(enabled);
  };

  const updateFontSize = (size: 'small' | 'default' | 'large') => {
    setSettings(prev => ({ ...prev, fontSize: size }));
    localStorage.setItem('font-size', size);
    applyFontSize(size);
  };

  const updateBorderRadius = (radius: 'none' | 'small' | 'default' | 'large') => {
    setSettings(prev => ({ ...prev, borderRadius: radius }));
    localStorage.setItem('border-radius', radius);
    applyBorderRadius(radius);
  };

  return {
    settings,
    isLoading,
    applyAccentColor,
    applyCompactMode,
    applyFontSize,
    applyBorderRadius,
    updateAccentColor,
    updateCompactMode,
    updateFontSize,
    updateBorderRadius,
  };
}

export { ACCENT_COLORS, FONT_SIZE_MAP, BORDER_RADIUS_MAP };
