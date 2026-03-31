import { DealProduct } from '@/types/sales';

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates numeric fields in deal/lead forms.
 * Returns array of error messages. Empty = valid.
 */
export function validateDealInputs(opts: {
  products: DealProduct[];
  expectedMargin: string;
  probability: string;
  skipProbability?: boolean;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const numRegex = /^-?\d*\.?\d*$/; // allows digits, optional decimal point

  opts.products.forEach((p, idx) => {
    const label = `Item #${idx + 1}`;

    const qtyStr = String(p.qty);
    if (!numRegex.test(qtyStr) || qtyStr.includes(',')) {
      errors.push({ field: `product_qty_${idx}`, message: `${label} — Qty mengandung karakter tidak valid (gunakan titik sebagai desimal, bukan koma)` });
    } else if (Number(p.qty) < 0) {
      errors.push({ field: `product_qty_${idx}`, message: `${label} — Qty tidak boleh negatif` });
    }

    const priceStr = String(p.pricePerUnit);
    if (!numRegex.test(priceStr) || priceStr.includes(',')) {
      errors.push({ field: `product_price_${idx}`, message: `${label} — Price/Unit mengandung karakter tidak valid (gunakan titik sebagai desimal)` });
    } else if (Number(p.pricePerUnit) < 0) {
      errors.push({ field: `product_price_${idx}`, message: `${label} — Price/Unit tidak boleh negatif` });
    }

    const costStr = String(p.otherCost);
    if (!numRegex.test(costStr) || costStr.includes(',')) {
      errors.push({ field: `product_cost_${idx}`, message: `${label} — Biaya Lainnya mengandung karakter tidak valid (gunakan titik sebagai desimal)` });
    } else if (Number(p.otherCost) < 0) {
      errors.push({ field: `product_cost_${idx}`, message: `${label} — Biaya Lainnya tidak boleh negatif` });
    }
  });

  if (opts.expectedMargin) {
    if (!numRegex.test(opts.expectedMargin) || opts.expectedMargin.includes(',')) {
      errors.push({ field: 'margin', message: 'Expected Margin mengandung karakter tidak valid (gunakan titik sebagai desimal)' });
    } else {
      const v = Number(opts.expectedMargin);
      if (v < 0 || v > 100) {
        errors.push({ field: 'margin', message: 'Expected Margin harus antara 0–100%' });
      }
    }
  }

  if (!opts.skipProbability && opts.probability) {
    if (!numRegex.test(opts.probability) || opts.probability.includes(',')) {
      errors.push({ field: 'probability', message: 'Probability mengandung karakter tidak valid (gunakan titik sebagai desimal)' });
    } else {
      const v = Number(opts.probability);
      if (v < 0 || v > 100) {
        errors.push({ field: 'probability', message: 'Probability harus antara 0–100%' });
      }
    }
  }

  return errors;
}
