import { getLocales } from 'expo-localization';

/**
 * Format an amount to a specific currency using the device locale.
 * @param amount - The numerical amount to format
 * @param currencyCode - The ISO 4217 currency code (e.g., 'USD', 'INR')
 */
export const formatCurrency = (amount: number, currencyCode: string = 'USD'): string => {
    // Attempt to get device locale, default to en-US
    const locales = getLocales();
    const deviceLocale = (locales && locales.length > 0 && locales[0]?.languageTag) ? locales[0].languageTag : 'en-US';
    
    return new Intl.NumberFormat(deviceLocale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};
