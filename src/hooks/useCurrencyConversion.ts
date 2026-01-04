import { useMemo, useCallback } from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';
import {
  convertCurrency,
  getExchangeRate,
  formatConvertedAmount,
  getSupportedCurrencies,
  isCurrencySupported,
  ConversionResult,
} from '@/lib/currency-conversion';

export function useCurrencyConversion() {
  const { settings } = useLocalization();
  const companyCurrency = settings.currency;

  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency?: string): ConversionResult => {
      const targetCurrency = toCurrency || companyCurrency;
      return convertCurrency(amount, fromCurrency, targetCurrency);
    },
    [companyCurrency]
  );

  const convertToCompanyCurrency = useCallback(
    (amount: number, fromCurrency: string): ConversionResult => {
      return convertCurrency(amount, fromCurrency, companyCurrency);
    },
    [companyCurrency]
  );

  const convertFromCompanyCurrency = useCallback(
    (amount: number, toCurrency: string): ConversionResult => {
      return convertCurrency(amount, companyCurrency, toCurrency);
    },
    [companyCurrency]
  );

  const formatConverted = useCallback(
    (amount: number, currency?: string): string => {
      const targetCurrency = currency || companyCurrency;
      return formatConvertedAmount(amount, targetCurrency);
    },
    [companyCurrency]
  );

  const getRate = useCallback(
    (fromCurrency: string, toCurrency?: string): number => {
      const targetCurrency = toCurrency || companyCurrency;
      return getExchangeRate(fromCurrency, targetCurrency);
    },
    [companyCurrency]
  );

  const supportedCurrencies = useMemo(() => getSupportedCurrencies(), []);

  return {
    companyCurrency,
    convert,
    convertToCompanyCurrency,
    convertFromCompanyCurrency,
    formatConverted,
    getRate,
    supportedCurrencies,
    isCurrencySupported,
  };
}
