import * as handlebars from 'handlebars';

// Register the 'eq' helper for equality comparison
handlebars.registerHelper('eq', (arg1, arg2) => arg1 === arg2);

// Register the 'incIndex' helper for incrementing index
handlebars.registerHelper('incIndex', (index: number) => index + 1);

// Register the 'currency' helper: Actual stores amounts in cents, so 1234 shows as 12.34.
// An "is between" amount condition holds { num1, num2 } and shows as "-20.00 and -10.00".
// A value that is not a number is returned as it is.
const formatCents = (value: unknown): unknown => {
  const cents = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return value;
  return (cents / 100).toFixed(2);
};

handlebars.registerHelper('currency', (value: unknown) => {
  if (typeof value === 'object' && value !== null && 'num1' in value && 'num2' in value) {
    return `${String(formatCents(value.num1))} and ${String(formatCents(value.num2))}`;
  }
  return formatCents(value);
});

export default handlebars;
