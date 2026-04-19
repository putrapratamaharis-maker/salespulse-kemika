import { Deal, DealProduct } from '@/types/sales';

export interface DuplicateMatch {
  deal: Deal;
  matchedProducts: { name: string; qty: number; pricePerUnit: number }[];
}

/**
 * Detects duplicate deals based on:
 * - Same Account/Customer
 * - Same Product (by productName, case-insensitive)
 * - Same Total Value (deal value)
 *
 * Excludes the deal being edited (by excludeDealId) and excludes
 * deals in terminal stages (canceled, lost).
 */
export function findDuplicateDeals(params: {
  accountId: string;
  products: DealProduct[];
  totalValue: number;
  existingDeals: Deal[];
  excludeDealId?: string;
}): DuplicateMatch[] {
  const { accountId, products, totalValue, existingDeals, excludeDealId } = params;

  if (!accountId || products.length === 0 || totalValue <= 0) return [];

  const productNames = new Set(
    products
      .map(p => (p.productName || '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (productNames.size === 0) return [];

  const matches: DuplicateMatch[] = [];

  for (const d of existingDeals) {
    if (excludeDealId && d.id === excludeDealId) continue;
    if (d.accountId !== accountId) continue;
    if (['canceled', 'lost'].includes(d.stage)) continue;

    // Compare value with small tolerance (within Rp 1)
    if (Math.abs((d.value || 0) - totalValue) > 1) continue;

    const overlapping = (d.products || []).filter(p =>
      productNames.has((p.productName || '').trim().toLowerCase())
    );

    if (overlapping.length > 0) {
      matches.push({
        deal: d,
        matchedProducts: overlapping.map(p => ({
          name: p.productName,
          qty: p.qty,
          pricePerUnit: p.pricePerUnit,
        })),
      });
    }
  }

  return matches;
}
