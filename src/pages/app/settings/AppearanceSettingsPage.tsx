import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, Check, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompanySetting, useUpdateCompanySetting } from '@/hooks/useCompanySettings';

const ACCENT_COLORS = [
  { name: 'Default', value: 'default', light: 'hsl(222.2 47.4% 11.2%)', dark: 'hsl(210 40% 98%)' },
  { name: 'Blue', value: 'blue', light: 'hsl(221.2 83.2% 53.3%)', dark: 'hsl(217.2 91.2% 59.8%)' },
  { name: 'Rose', value: 'rose', light: 'hsl(346.8 77.2% 49.8%)', dark: 'hsl(346.8 77.2% 59.8%)' },
  { name: 'Orange', value: 'orange', light: 'hsl(24.6 95% 53.1%)', dark: 'hsl(20.5 90.2% 58.2%)' },
  { name: 'Green', value: 'green', light: 'hsl(142.1 76.2% 36.3%)', dark: 'hsl(142.1 70.6% 45.3%)' },
  { name: 'Purple', value: 'purple', light: 'hsl(262.1 83.3% 57.8%)', dark: 'hsl(263.4 70% 50.4%)' },
  { name: 'Cyan', value: 'cyan', light: 'hsl(192 91% 36%)', dark: 'hsl(186 94% 45%)' },
  { name: 'Amber', value: 'amber', light: 'hsl(38 92% 50%)', dark: 'hsl(38 92% 55%)' },
  { name: 'Indigo', value: 'indigo', light: 'hsl(239 84% 67%)', dark: 'hsl(239 84% 72%)' },
];

const SIDEBAR_COLORS = [
  { name: 'Default', value: 'default', color: 'hsl(0 0% 98%)' },
  { name: 'Dark', value: 'dark', color: 'hsl(222.2 84% 4.9%)' },
  { name: 'Blue', value: 'blue', color: 'hsl(222.2 47.4% 11.2%)' },
  { name: 'Slate', value: 'slate', color: 'hsl(215.4 16.3% 15%)' },
];

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

const BORDER_RADIUS = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

interface AppearanceSettings {
  accentColor: string;
  sidebarColor: string;
  compactMode: boolean;
  fontSize: string;
  borderRadius: string;
  theme: string;
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  accentColor: 'default',
  sidebarColor: 'default',
  compactMode: false,
  fontSize: 'default',
  borderRadius: 'default',
  theme: 'system',
};

const FONT_SIZE_MAP: Record<string, string> = {
  small: '14px',
  default: '16px',
  large: '18px',
};

const BORDER_RADIUS_MAP: Record<string, string> = {
  none: '0',
  small: '0.25rem',
  default: '0.5rem',
  large: '0.75rem',
};

function applySettings(settings: AppearanceSettings, isDark: boolean) {
  const root = document.documentElement;
  
  // Apply accent color
  const accentConfig = ACCENT_COLORS.find(c => c.value === settings.accentColor) || ACCENT_COLORS[0];
  const colorHsl = isDark ? accentConfig.dark : accentConfig.light;
  // Extract HSL values from hsl() string
  const hslMatch = colorHsl.match(/hsl\(([^)]+)\)/);
  if (hslMatch) {
    root.style.setProperty('--primary', hslMatch[1]);
    root.style.setProperty('--ring', hslMatch[1]);
    root.style.setProperty('--sidebar-primary', hslMatch[1]);
  }
  
  // Apply compact mode
  if (settings.compactMode) {
    root.classList.add('compact');
  } else {
    root.classList.remove('compact');
  }
  
  // Apply font size
  root.style.setProperty('--base-font-size', FONT_SIZE_MAP[settings.fontSize] || '16px');
  
  // Apply border radius
  root.style.setProperty('--radius', BORDER_RADIUS_MAP[settings.borderRadius] || '0.5rem');
}

export function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: savedSettings, isLoading } = useCompanySetting<AppearanceSettings>('appearance');
  const updateSetting = useUpdateCompanySetting();
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (savedSettings) {
      const merged = { ...DEFAULT_SETTINGS, ...savedSettings };
      setSettings(merged);
      if (merged.theme && merged.theme !== theme) {
        setTheme(merged.theme);
      }
      applySettings(merged, resolvedTheme === 'dark');
    }
  }, [savedSettings, resolvedTheme]);

  // Re-apply when theme changes
  useEffect(() => {
    if (mounted) {
      applySettings(settings, resolvedTheme === 'dark');
    }
  }, [resolvedTheme, mounted]);

  const handleChange = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(true);
    
    // Apply immediately for preview
    if (key === 'theme') {
      setTheme(value as string);
    }
    applySettings(newSettings, resolvedTheme === 'dark');
  };

  const handleSave = async () => {
    await updateSetting.mutateAsync({
      key: 'appearance',
      value: settings as unknown as Record<string, unknown>,
      description: 'Company appearance preferences',
    });
    setHasChanges(false);
    toast.success('Appearance settings saved');
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Appearance</h2>
        <p className="text-muted-foreground">Customize the look and feel of your company workspace</p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => handleChange('theme', value)}
            className="grid grid-cols-3 gap-4"
          >
            <Label
              htmlFor="theme-light"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                theme === 'light' ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <RadioGroupItem value="light" id="theme-light" className="sr-only" />
              <Sun className="h-6 w-6" />
              <span className="text-sm font-medium">Light</span>
            </Label>
            <Label
              htmlFor="theme-dark"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                theme === 'dark' ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
              <Moon className="h-6 w-6" />
              <span className="text-sm font-medium">Dark</span>
            </Label>
            <Label
              htmlFor="theme-system"
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                theme === 'system' ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <RadioGroupItem value="system" id="theme-system" className="sr-only" />
              <Monitor className="h-6 w-6" />
              <span className="text-sm font-medium">System</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Accent Color
          </CardTitle>
          <CardDescription>Choose your primary accent color for buttons, links, and highlights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleChange('accentColor', color.value)}
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
                  settings.accentColor === color.value && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                )}
                style={{ backgroundColor: resolvedTheme === 'dark' ? color.dark : color.light }}
                title={color.name}
              >
                {settings.accentColor === color.value && (
                  <Check className="h-5 w-5 text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Selected: <span className="font-medium capitalize">{settings.accentColor}</span>
          </p>
        </CardContent>
      </Card>

      {/* Sidebar Color */}
      <Card>
        <CardHeader>
          <CardTitle>Sidebar Style</CardTitle>
          <CardDescription>Choose sidebar background color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {SIDEBAR_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleChange('sidebarColor', color.value)}
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background border",
                  settings.sidebarColor === color.value && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                )}
                style={{ backgroundColor: color.color }}
                title={color.name}
              >
                {settings.sidebarColor === color.value && (
                  <Check className={cn("h-5 w-5 drop-shadow-md", color.value !== 'default' ? 'text-white' : 'text-foreground')} />
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Selected: <span className="font-medium capitalize">{settings.sidebarColor}</span>
          </p>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
          <CardDescription>Adjust how content is displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compact-mode">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing and padding for a denser interface
              </p>
            </div>
            <Switch
              id="compact-mode"
              checked={settings.compactMode}
              onCheckedChange={(checked) => handleChange('compactMode', checked)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Select value={settings.fontSize} onValueChange={(v) => handleChange('fontSize', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Border Radius</Label>
              <Select value={settings.borderRadius} onValueChange={(v) => handleChange('borderRadius', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_RADIUS.map((radius) => (
                    <SelectItem key={radius.value} value={radius.value}>
                      {radius.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSetting.isPending || !hasChanges}>
          {updateSetting.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default AppearanceSettingsPage;
