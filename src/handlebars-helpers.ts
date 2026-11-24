import * as handlebars from 'handlebars';
import { MoneyFormat } from './types';

// Register the 'eq' helper for equality comparison
handlebars.registerHelper('eq', (arg1, arg2) => arg1 === arg2);

// Register the 'incIndex' helper for incrementing index
handlebars.registerHelper('incIndex', (index: number) => index + 1);

// Register the 'currency' helper. Actual stores every amount as an integer in hundredths,
// whatever the budget's currency, so 1234 is 12.34. The budget's currency (the template's
// currencyCode) sets the symbol and the decimals: 1234 shows as $12.34 in a USD budget,
// 123400 as ¥1,234 in a JPY budget, and 1234 as 12.34 when the budget has no currency.
// The locale of the budget's number format (the template's locale) sets the separators and
// where the symbol goes, so 123450 shows as 1.234,50 € in a EUR budget with the 1.000,33 format.
// An "is between" amount condition holds { num1, num2 } and shows as "-$20.00 and -$10.00".
// A value that is not a number is returned as it is.
const formatMoney = (amount: number, { currencyCode, locale }: MoneyFormat): string => {
  if (currencyCode) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
        .format(amount);
    } catch {
      // Not a code Intl accepts: show the plain amount.
    }
  }
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(amount);
};

const formatCents = (value: unknown, moneyFormat: MoneyFormat): unknown => {
  const cents = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return value;
  return formatMoney(cents / 100, moneyFormat);
};

handlebars.registerHelper('currency', (value: unknown, options: handlebars.HelperOptions) => {
  const root = (options.data as { root?: { currencyCode?: unknown; locale?: unknown } } | undefined)
    ?.root;
  const moneyFormat: MoneyFormat = {
    currencyCode: typeof root?.currencyCode === 'string' ? root.currencyCode : '',
    locale: typeof root?.locale === 'string' && root.locale ? root.locale : 'en-US',
  };
  if (typeof value === 'object' && value !== null && 'num1' in value && 'num2' in value) {
    return `${String(formatCents(value.num1, moneyFormat))} and ${String(formatCents(value.num2, moneyFormat))}`;
  }
  return formatCents(value, moneyFormat);
});

export default handlebars;
