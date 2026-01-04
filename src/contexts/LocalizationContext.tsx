import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useCompanySetting } from '@/hooks/useCompanySettings';
import { format as dateFnsFormat, parse } from 'date-fns';

export interface LocalizationSettings {
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'sunday' | 'monday' | 'saturday';
  currency: string;
  timezone: string;
  numberFormat: string;
}

const DEFAULT_SETTINGS: LocalizationSettings = {
  language: 'en',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  firstDayOfWeek: 'sunday',
  currency: 'USD',
  timezone: 'UTC',
  numberFormat: 'en-US',
};

// Currency symbols and configurations
export const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; position: 'before' | 'after' }> = {
  USD: { symbol: '$', locale: 'en-US', position: 'before' },
  EUR: { symbol: '€', locale: 'de-DE', position: 'before' },
  GBP: { symbol: '£', locale: 'en-GB', position: 'before' },
  INR: { symbol: '₹', locale: 'en-IN', position: 'before' },
  JPY: { symbol: '¥', locale: 'ja-JP', position: 'before' },
  AUD: { symbol: 'A$', locale: 'en-AU', position: 'before' },
  CAD: { symbol: 'C$', locale: 'en-CA', position: 'before' },
  PKR: { symbol: '₨', locale: 'ur-PK', position: 'before' },
  SAR: { symbol: '﷼', locale: 'ar-SA', position: 'after' },
  AED: { symbol: 'د.إ', locale: 'ar-AE', position: 'after' },
  BDT: { symbol: '৳', locale: 'bn-BD', position: 'before' },
  NGN: { symbol: '₦', locale: 'en-NG', position: 'before' },
  ZAR: { symbol: 'R', locale: 'en-ZA', position: 'before' },
  BRL: { symbol: 'R$', locale: 'pt-BR', position: 'before' },
  MXN: { symbol: '$', locale: 'es-MX', position: 'before' },
  KRW: { symbol: '₩', locale: 'ko-KR', position: 'before' },
  SGD: { symbol: 'S$', locale: 'en-SG', position: 'before' },
  THB: { symbol: '฿', locale: 'th-TH', position: 'before' },
  PHP: { symbol: '₱', locale: 'fil-PH', position: 'before' },
  MYR: { symbol: 'RM', locale: 'ms-MY', position: 'before' },
  IDR: { symbol: 'Rp', locale: 'id-ID', position: 'before' },
  CNY: { symbol: '¥', locale: 'zh-CN', position: 'before' },
  CHF: { symbol: 'CHF', locale: 'de-CH', position: 'before' },
  SEK: { symbol: 'kr', locale: 'sv-SE', position: 'after' },
  NOK: { symbol: 'kr', locale: 'nb-NO', position: 'after' },
  DKK: { symbol: 'kr', locale: 'da-DK', position: 'after' },
  PLN: { symbol: 'zł', locale: 'pl-PL', position: 'after' },
  TRY: { symbol: '₺', locale: 'tr-TR', position: 'before' },
  RUB: { symbol: '₽', locale: 'ru-RU', position: 'after' },
  HKD: { symbol: 'HK$', locale: 'zh-HK', position: 'before' },
  TWD: { symbol: 'NT$', locale: 'zh-TW', position: 'before' },
  NZD: { symbol: 'NZ$', locale: 'en-NZ', position: 'before' },
};

interface LocalizationContextType {
  settings: LocalizationSettings;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string, formatStr?: string) => string;
  formatTime: (date: Date | string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  isLoading: boolean;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { data: savedSettings, isLoading } = useCompanySetting('localization');
  const [settings, setSettings] = useState<LocalizationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (savedSettings?.value) {
      const saved = savedSettings.value as unknown as Partial<LocalizationSettings>;
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
    }
  }, [savedSettings]);

  const formatCurrency = (amount: number, currency?: string): string => {
    const curr = currency || settings.currency;
    const config = CURRENCY_CONFIG[curr] || CURRENCY_CONFIG.USD;
    
    try {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: curr === 'JPY' || curr === 'KRW' ? 0 : 2,
        maximumFractionDigits: curr === 'JPY' || curr === 'KRW' ? 0 : 2,
      }).format(amount);
    } catch {
      // Fallback for unsupported currencies
      const formatted = amount.toFixed(2);
      return config.position === 'before' 
        ? `${config.symbol}${formatted}` 
        : `${formatted} ${config.symbol}`;
    }
  };

  const formatDate = (date: Date | string, formatStr?: string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';

      // Convert format string from user-friendly to date-fns format
      const format = formatStr || settings.dateFormat;
      const dateFnsFormatStr = format
        .replace('YYYY', 'yyyy')
        .replace('DD', 'dd');

      return dateFnsFormat(dateObj, dateFnsFormatStr);
    } catch {
      return '-';
    }
  };

  const formatTime = (date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '-';

      const format = settings.timeFormat === '24h' ? 'HH:mm' : 'h:mm a';
      return dateFnsFormat(dateObj, format);
    } catch {
      return '-';
    }
  };

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(settings.numberFormat, options).format(num);
    } catch {
      return num.toString();
    }
  };

  return (
    <LocalizationContext.Provider
      value={{
        settings,
        formatCurrency,
        formatDate,
        formatTime,
        formatNumber,
        isLoading,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    // Return default implementation if not wrapped
    return {
      settings: DEFAULT_SETTINGS,
      formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
      formatDate: (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString();
      },
      formatTime: (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleTimeString();
      },
      formatNumber: (num: number) => num.toLocaleString(),
      isLoading: false,
    };
  }
  return context;
}
