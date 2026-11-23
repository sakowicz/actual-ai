import * as handlebars from 'handlebars';

// Register the 'eq' helper for equality comparison
handlebars.registerHelper('eq', (arg1, arg2) => arg1 === arg2);

// Register the 'incIndex' helper for incrementing index
handlebars.registerHelper('incIndex', (index: number) => index + 1);

// Register the 'currency' helper. Actual stores every amount as an integer in hundredths,
// whatever the budget's currency, so 1234 is 12.34. The budget's currency (the template's
// currencyCode) sets the symbol and the decimals: 1234 shows as $12.34 in a USD budget,
// 123400 as ¥1,234 in a JPY budget, and 1234 as 12.34 when the budget has no currency.
// An "is between" amount condition holds { num1, num2 } and shows as "-$20.00 and -$10.00".
// A value that is not a number is returned as it is.
const formatMoney = (amount: number, currencyCode: string): string => {
  if (currencyCode) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
        .format(amount);
    } catch {
      // Not a code Intl accepts: show the plain amount.
    }
  }
  return amount.toFixed(2);
};

const formatCents = (value: unknown, currencyCode: string): unknown => {
  const cents = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return value;
  return formatMoney(cents / 100, currencyCode);
};

handlebars.registerHelper('currency', (value: unknown, options: handlebars.HelperOptions) => {
  const root = (options.data as { root?: { currencyCode?: unknown } } | undefined)?.root;
  const currencyCode = typeof root?.currencyCode === 'string' ? root.currencyCode : '';
  if (typeof value === 'object' && value !== null && 'num1' in value && 'num2' in value) {
    return `${String(formatCents(value.num1, currencyCode))} and ${String(formatCents(value.num2, currencyCode))}`;
  }
  return formatCents(value, currencyCode);
});

export default handlebars;
