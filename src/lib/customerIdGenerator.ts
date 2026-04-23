import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds the prefix and exclusive upper-bound used to range-scan
 * the `accounts.customer_id` column for a given year.
 *
 * Example: year=2026 → { prefix: "CUST2026-", upperBound: "CUST2026." }
 *
 * The upper bound uses '.' (the next ASCII char after '-') so that the
 * range filter `gte(prefix) && lt(upperBound)` covers exactly the rows
 * `CUST2026-XXXX` and is sargable against a `text_pattern_ops` index.
 */
export function buildCustomerIdRange(year: number): {
  prefix: string;
  upperBound: string;
} {
  const prefix = `CUST${year}-`;
  const upperBound = `CUST${year}.`;
  return { prefix, upperBound };
}

/**
 * Parses the numeric suffix from an existing customer_id.
 * Returns 0 if the suffix is missing or invalid.
 *
 * Example: parseCustomerIdSequence("CUST2026-0042", "CUST2026-") → 42
 */
export function parseCustomerIdSequence(
  customerId: string | null | undefined,
  prefix: string,
): number {
  if (!customerId) return 0;
  const tail = customerId.replace(prefix, '');
  const n = parseInt(tail, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Formats the next Customer ID for the given year and last sequence.
 * Always 4-digit zero padded.
 *
 * Example: formatNextCustomerId(2026, 42) → "CUST2026-0043"
 */
export function formatNextCustomerId(year: number, lastSequence: number): string {
  const { prefix } = buildCustomerIdRange(year);
  const next = (lastSequence < 0 ? 0 : lastSequence) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/**
 * Generates the next Customer ID for the given year by querying
 * Supabase with a sargable range filter (uses idx_accounts_customer_id_pattern).
 *
 * Performance: ALWAYS issues exactly one round-trip selecting at most
 * one row, regardless of total accounts in the database.
 */
export async function generateNextCustomerId(
  supabase: SupabaseClient<any, any, any>,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const { prefix, upperBound } = buildCustomerIdRange(year);
  const { data } = await supabase
    .from('accounts')
    .select('customer_id')
    .gte('customer_id', prefix)
    .lt('customer_id', upperBound)
    .order('customer_id', { ascending: false })
    .limit(1);

  const last = data && data.length > 0
    ? parseCustomerIdSequence(data[0].customer_id, prefix)
    : 0;
  return formatNextCustomerId(year, last);
}
