/**
 * Currency-aware money type.
 * All monetary values are stored as integer minor units (e.g., paise for INR, cents for USD).
 * This avoids floating-point arithmetic errors in financial calculations.
 *
 * IMPORTANT: The canonical entry point is `moneyFromMinor()` which accepts only safe integers.
 * `moneyFromMajor()` is a convenience for user input but inherits IEEE 754 imprecision —
 * callers parsing decimal strings (e.g. "10.005") should use `moneyFromDecimalString()`
 * which avoids float multiplication entirely.
 */

/** ISO 4217 currency codes supported by EventPilot */
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

/** Number of minor units per major unit for each currency */
export const CURRENCY_MINOR_UNITS: Record<CurrencyCode, number> = {
  INR: 100, // 1 INR = 100 paise
  USD: 100, // 1 USD = 100 cents
  EUR: 100, // 1 EUR = 100 cents
  GBP: 100, // 1 GBP = 100 pence
};

/** Currency display symbols */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Immutable money value with currency.
 * `amountMinor` is always an integer representing minor units.
 */
export interface Money {
  readonly amountMinor: number; // Integer minor units (paise, cents, etc.)
  readonly currency: CurrencyCode;
}

/**
 * Create a Money value from minor units.
 * This is the CANONICAL constructor — all other constructors delegate to it.
 * Throws if amountMinor is not a safe integer.
 */
export function moneyFromMinor(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`amountMinor must be a safe integer, got: ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/**
 * Create a Money value from a float major unit (e.g., from a parsed number like 150.75).
 *
 * WARNING: This function inherits IEEE 754 imprecision. The input `10.005` is actually
 * stored as `10.00499999999999934...` in float64, so `10.005 * 100 = 1000.4999...`
 * which rounds to 1000, not 1001. This is mathematically correct given the float input,
 * but may surprise users who typed "10.005".
 *
 * For exact decimal string input, use `moneyFromDecimalString()` instead.
 */
export function moneyFromMajor(amountMajor: number, currency: CurrencyCode): Money {
  const minorUnits = CURRENCY_MINOR_UNITS[currency];
  const raw = amountMajor * minorUnits;
  const rounded = bankersRound(raw);
  return moneyFromMinor(rounded, currency);
}

/**
 * Create a Money value from a decimal string (e.g., "10.005", "1500.50").
 * This avoids float multiplication entirely by parsing the integer and fractional parts.
 *
 * Applies banker's rounding when the string has more decimal places than the currency allows.
 * Example: "10.005" INR → exact 1000.5 → banker's round → 1000 paise (even)
 * Example: "10.015" INR → exact 1001.5 → banker's round → 1002 paise (even)
 */
export function moneyFromDecimalString(decimalString: string, currency: CurrencyCode): Money {
  const trimmed = decimalString.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal string: "${decimalString}"`);
  }

  const isNegative = trimmed.startsWith('-');
  const absolute = isNegative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ''] = absolute.split('.');

  const minorUnits = CURRENCY_MINOR_UNITS[currency];
  const minorDigits = Math.log10(minorUnits); // 2 for 100-based currencies

  // Pad or truncate fractional part to one digit beyond minor unit precision
  // so we can do correct rounding
  const targetLen = minorDigits + 1; // e.g. 3 digits for 2-decimal currencies
  const paddedFrac = fracPart.padEnd(Math.ceil(targetLen), '0');

  // The fractional part as an integer (in tenths of minor units for rounding)
  // e.g., "005" → 5 (tenths of a cent), "015" → 15 (tenths of a cent)
  const fracDigitsForMinor = paddedFrac.slice(0, minorDigits); // "00" from "005"
  const roundingDigit = paddedFrac.slice(minorDigits, minorDigits + 1); // "5" from "005"
  const remainingDigits = paddedFrac.slice(minorDigits + 1); // anything beyond

  const intValue = parseInt(intPart, 10) * minorUnits;
  const fracValue = parseInt(fracDigitsForMinor || '0', 10);
  let minorAmount = intValue + fracValue;

  // Apply rounding based on the digit beyond minor unit precision
  const roundDigit = parseInt(roundingDigit || '0', 10);
  const hasRemainder = remainingDigits.length > 0 && parseInt(remainingDigits, 10) > 0;

  if (roundDigit > 5 || (roundDigit === 5 && hasRemainder)) {
    // Round up
    minorAmount += 1;
  } else if (roundDigit === 5 && !hasRemainder) {
    // Banker's rounding: round to even
    if (minorAmount % 2 !== 0) {
      minorAmount += 1;
    }
  }
  // roundDigit < 5: truncate (do nothing)

  if (isNegative) {
    minorAmount = -minorAmount;
  }

  return moneyFromMinor(minorAmount, currency);
}

/**
 * Convert Money to major units for display. Returns a number (may have decimals).
 */
export function moneyToMajor(money: Money): number {
  return money.amountMinor / CURRENCY_MINOR_UNITS[money.currency];
}

/**
 * Format Money for display with currency symbol.
 * Example: moneyFormat({ amountMinor: 150075, currency: 'INR' }) => "₹1,500.75"
 */
export function moneyFormat(money: Money): string {
  const major = moneyToMajor(money);
  const symbol = CURRENCY_SYMBOLS[money.currency];
  // Use Indian locale for INR, generic for others
  const locale = money.currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = major.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

/** Ensure two Money values have the same currency before arithmetic */
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: cannot combine ${a.currency} with ${b.currency}`
    );
  }
}

/** Add two Money values. Both must share the same currency. */
export function moneyAdd(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return moneyFromMinor(a.amountMinor + b.amountMinor, a.currency);
}

/** Subtract b from a. Both must share the same currency. */
export function moneySubtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return moneyFromMinor(a.amountMinor - b.amountMinor, a.currency);
}

/** Multiply money by a scalar (e.g., quantity). Result is rounded. */
export function moneyMultiply(money: Money, factor: number): Money {
  const result = bankersRound(money.amountMinor * factor);
  return moneyFromMinor(result, money.currency);
}

/**
 * Allocate a Money amount across N parts proportionally based on ratios.
 * Handles remainder distribution to avoid rounding loss.
 * Sum of results always equals the input exactly.
 *
 * Example: allocate(1000 paise, [1, 1, 1]) => [334, 333, 333] paise
 */
export function moneyAllocate(money: Money, ratios: number[]): Money[] {
  if (ratios.length === 0) {
    throw new Error('Cannot allocate to zero parts');
  }
  const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
  if (totalRatio <= 0) {
    throw new Error('Total ratio must be positive');
  }

  const total = money.amountMinor;
  const results: number[] = ratios.map((ratio) =>
    Math.floor((total * ratio) / totalRatio)
  );

  // Distribute remainder one unit at a time to the largest fractional parts
  let remainder = total - results.reduce((sum, v) => sum + v, 0);
  const fractionals = ratios.map((ratio, i) => ({
    index: i,
    fraction: ((total * ratio) / totalRatio) - results[i],
  }));
  fractionals.sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0; i++, remainder--) {
    results[fractionals[i].index] += 1;
  }

  return results.map((amount) => moneyFromMinor(amount, money.currency));
}

/** Sum an array of Money values. All must share the same currency. */
export function moneySum(values: Money[]): Money {
  if (values.length === 0) {
    throw new Error('Cannot sum empty array — currency is unknown');
  }
  return values.reduce((acc, val) => moneyAdd(acc, val));
}

/** Return the zero value for a given currency */
export function moneyZero(currency: CurrencyCode): Money {
  return moneyFromMinor(0, currency);
}

/** Check if money is negative */
export function moneyIsNegative(money: Money): boolean {
  return money.amountMinor < 0;
}

/** Check if money is zero */
export function moneyIsZero(money: Money): boolean {
  return money.amountMinor === 0;
}

/** Compare two Money values. Returns -1, 0, or 1. */
export function moneyCompare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

/**
 * Banker's rounding: round half to nearest even integer.
 * This reduces cumulative rounding bias.
 *
 * NOTE: This operates on IEEE 754 floats. Values that appear to be exactly X.5
 * may not be due to float representation. This function checks for exact .5
 * within a small epsilon and rounds to even in that case.
 */
export function bankersRound(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round non-finite value: ${value}`);
  }

  const floor = Math.floor(value);
  const decimal = value - floor;

  // Check if we're at exactly .5 (within float epsilon)
  if (Math.abs(decimal - 0.5) < 1e-9) {
    // Round to even
    return floor % 2 === 0 ? floor : floor + 1;
  }

  return Math.round(value);
}
