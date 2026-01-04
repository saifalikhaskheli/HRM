import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanySetting, useUpdateCompanySetting } from '@/hooks/useCompanySettings';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'ar', label: 'العربية' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'ur', label: 'اردو' },
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2024)' },
];

const TIME_FORMATS = [
  { value: '12h', label: '12-hour (3:30 PM)' },
  { value: '24h', label: '24-hour (15:30)' },
];

const FIRST_DAY_OPTIONS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'saturday', label: 'Saturday' },
];

const CURRENCY_FORMATS = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'PKR', label: 'Pakistani Rupee (₨)' },
  { value: 'JPY', label: 'Japanese Yen (¥)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'SAR', label: 'Saudi Riyal (﷼)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' },
  { value: 'BDT', label: 'Bangladeshi Taka (৳)' },
  { value: 'NGN', label: 'Nigerian Naira (₦)' },
  { value: 'ZAR', label: 'South African Rand (R)' },
  { value: 'BRL', label: 'Brazilian Real (R$)' },
  { value: 'MXN', label: 'Mexican Peso ($)' },
  { value: 'SGD', label: 'Singapore Dollar (S$)' },
  { value: 'MYR', label: 'Malaysian Ringgit (RM)' },
  { value: 'THB', label: 'Thai Baht (฿)' },
  { value: 'PHP', label: 'Philippine Peso (₱)' },
  { value: 'IDR', label: 'Indonesian Rupiah (Rp)' },
  { value: 'CNY', label: 'Chinese Yuan (¥)' },
  { value: 'KRW', label: 'Korean Won (₩)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'TRY', label: 'Turkish Lira (₺)' },
];

const CURRENCY_POSITIONS = [
  { value: 'before', label: 'Before amount ($100)' },
  { value: 'after', label: 'After amount (100$)' },
];

const DECIMAL_PRECISION = [
  { value: '0', label: 'No decimals (100)' },
  { value: '2', label: 'Two decimals (100.00)' },
];

const THOUSAND_SEPARATORS = [
  { value: 'comma', label: 'Comma (1,000,000)' },
  { value: 'period', label: 'Period (1.000.000)' },
  { value: 'space', label: 'Space (1 000 000)' },
  { value: 'none', label: 'None (1000000)' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (BST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (MYT)' },
  { value: 'Asia/Jakarta', label: 'Indonesia (WIB)' },
  { value: 'Asia/Manila', label: 'Philippines (PHT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Africa/Lagos', label: 'Nigeria (WAT)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
];

const PAYROLL_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'weekly', label: 'Weekly' },
];

const WORKWEEK_OPTIONS = [
  { value: '5', label: '5-day workweek (Mon-Fri)' },
  { value: '6', label: '6-day workweek (Mon-Sat)' },
  { value: '5.5', label: '5.5-day workweek (Mon-Sat half)' },
];

const NUMBER_FORMATS = [
  { value: 'en-US', label: 'English (US) - 1,234.56' },
  { value: 'en-GB', label: 'English (UK) - 1,234.56' },
  { value: 'de-DE', label: 'German - 1.234,56' },
  { value: 'fr-FR', label: 'French - 1 234,56' },
  { value: 'es-ES', label: 'Spanish - 1.234,56' },
  { value: 'hi-IN', label: 'Indian - 1,23,456.78' },
];

interface LocalizationSettings {
  language: string;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  currency: string;
  currencyPosition: string;
  decimalPrecision: string;
  thousandSeparator: string;
  timezone: string;
  payrollCycle: string;
  workweek: string;
  numberFormat: string;
}

const DEFAULT_SETTINGS: LocalizationSettings = {
  language: 'en',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  firstDayOfWeek: 'sunday',
  currency: 'USD',
  currencyPosition: 'before',
  decimalPrecision: '2',
  thousandSeparator: 'comma',
  timezone: 'UTC',
  payrollCycle: 'monthly',
  workweek: '5',
  numberFormat: 'en-US',
};

export function LocalizationSettingsPage() {
  const { data: savedSettings, isLoading } = useCompanySetting<LocalizationSettings>('localization');
  const updateSetting = useUpdateCompanySetting();
  const [settings, setSettings] = useState<LocalizationSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
    }
  }, [savedSettings]);

  const handleChange = (key: keyof LocalizationSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSetting.mutateAsync({
      key: 'localization',
      value: settings as unknown as Record<string, unknown>,
      description: 'Company localization preferences',
    });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Localization</h2>
        <p className="text-muted-foreground">Configure language, date, time, and regional settings for your company</p>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle>Language</CardTitle>
          <CardDescription>Select your preferred language for the interface</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={settings.language} onValueChange={(v) => handleChange('language', v)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Date & Time */}
      <Card>
        <CardHeader>
          <CardTitle>Date & Time</CardTitle>
          <CardDescription>Configure how dates and times are displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={settings.dateFormat} onValueChange={(v) => handleChange('dateFormat', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select value={settings.timeFormat} onValueChange={(v) => handleChange('timeFormat', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time format" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Week Starts On</Label>
              <Select value={settings.firstDayOfWeek} onValueChange={(v) => handleChange('firstDayOfWeek', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first day" />
                </SelectTrigger>
                <SelectContent>
                  {FIRST_DAY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => handleChange('timezone', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency & Numbers */}
      <Card>
        <CardHeader>
          <CardTitle>Currency & Numbers</CardTitle>
          <CardDescription>Set currency and number formatting preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => handleChange('currency', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_FORMATS.map(currency => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Symbol Position</Label>
              <Select value={settings.currencyPosition} onValueChange={(v) => handleChange('currencyPosition', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_POSITIONS.map(pos => (
                    <SelectItem key={pos.value} value={pos.value}>
                      {pos.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Decimal Precision</Label>
              <Select value={settings.decimalPrecision} onValueChange={(v) => handleChange('decimalPrecision', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select precision" />
                </SelectTrigger>
                <SelectContent>
                  {DECIMAL_PRECISION.map(prec => (
                    <SelectItem key={prec.value} value={prec.value}>
                      {prec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Thousand Separator</Label>
              <Select value={settings.thousandSeparator} onValueChange={(v) => handleChange('thousandSeparator', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select separator" />
                </SelectTrigger>
                <SelectContent>
                  {THOUSAND_SEPARATORS.map(sep => (
                    <SelectItem key={sep.value} value={sep.value}>
                      {sep.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Number Format</Label>
            <Select value={settings.numberFormat} onValueChange={(v) => handleChange('numberFormat', v)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select number format" />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMATS.map(fmt => (
                  <SelectItem key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Localization */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Settings</CardTitle>
          <CardDescription>Configure default payroll cycle and workweek</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Payroll Cycle</Label>
              <Select value={settings.payrollCycle} onValueChange={(v) => handleChange('payrollCycle', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {PAYROLL_CYCLES.map(cycle => (
                    <SelectItem key={cycle.value} value={cycle.value}>
                      {cycle.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Workweek</Label>
              <Select value={settings.workweek} onValueChange={(v) => handleChange('workweek', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workweek" />
                </SelectTrigger>
                <SelectContent>
                  {WORKWEEK_OPTIONS.map(week => (
                    <SelectItem key={week.value} value={week.value}>
                      {week.label}
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

export default LocalizationSettingsPage;
