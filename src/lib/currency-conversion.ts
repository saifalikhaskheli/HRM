// Exchange rates relative to USD (base currency)
// These can be updated periodically or fetched from an API
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.12,
  PKR: 278.50,
  AED: 3.67,
  SAR: 3.75,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.50,
  CNY: 7.24,
  SGD: 1.34,
  MYR: 4.47,
  BDT: 109.75,
  PHP: 55.80,
  IDR: 15650,
  THB: 35.20,
  VND: 24500,
  KRW: 1320,
  ZAR: 18.50,
  NGN: 1550,
  EGP: 30.90,
  BRL: 4.97,
  MXN: 17.15,
  CHF: 0.88,
  SEK: 10.45,
  NOK: 10.65,
  DKK: 6.88,
  PLN: 4.02,
  CZK: 22.75,
  HUF: 355,
  TRY: 32.50,
  RUB: 92.50,
  NZD: 1.64,
  HKD: 7.82,
  TWD: 31.50,
  KWD: 0.31,
  QAR: 3.64,
  BHD: 0.38,
  OMR: 0.38,
};

export interface ConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
}

/**
 * Get the exchange rate between two currencies
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  const fromRate = EXCHANGE_RATES[fromCurrency];
  const toRate = EXCHANGE_RATES[toCurrency];

  if (!fromRate || !toRate) {
    console.warn(`Exchange rate not found for ${fromCurrency} or ${toCurrency}`);
    return 1;
  }

  // Convert: fromCurrency -> USD -> toCurrency
  return toRate / fromRate;
}

/**
 * Convert an amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): ConversionResult {
  const exchangeRate = getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = amount * exchangeRate;

  return {
    amount,
    fromCurrency,
    toCurrency,
    convertedAmount,
    exchangeRate,
    timestamp: new Date(),
  };
}

/**
 * Format a converted amount with currency symbol
 */
export function formatConvertedAmount(
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(EXCHANGE_RATES);
}

/**
 * Check if a currency is supported
 */
export function isCurrencySupported(currency: string): boolean {
  return currency in EXCHANGE_RATES;
}

/**
 * Update exchange rates (for when fetching from API)
 */
export function updateExchangeRates(rates: Record<string, number>): void {
  Object.assign(EXCHANGE_RATES, rates);
}

/**
 * Get current exchange rates
 */
export function getExchangeRates(): Record<string, number> {
  return { ...EXCHANGE_RATES };
}
