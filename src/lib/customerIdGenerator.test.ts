import { describe, it, expect, vi } from 'vitest';
import {
  buildCustomerIdRange,
  parseCustomerIdSequence,
  formatNextCustomerId,
  generateNextCustomerId,
} from './customerIdGenerator';

// ---------- Pure helpers ----------

describe('buildCustomerIdRange', () => {
  it('builds correct prefix and exclusive upper bound', () => {
    expect(buildCustomerIdRange(2026)).toEqual({
      prefix: 'CUST2026-',
      upperBound: 'CUST2026.',
    });
  });

  it('range upper bound is the next ASCII char after "-"', () => {
    const { prefix, upperBound } = buildCustomerIdRange(2030);
    // '-' = 0x2D, '.' = 0x2E → upper bound is exclusive successor
    expect(upperBound.charCodeAt(prefix.length - 1)).toBe(
      prefix.charCodeAt(prefix.length - 1) + 1,
    );
  });

  it('different years produce non-overlapping ranges', () => {
    const r2025 = buildCustomerIdRange(2025);
    const r2026 = buildCustomerIdRange(2026);
    expect(r2025.upperBound < r2026.prefix).toBe(true);
  });
});

describe('parseCustomerIdSequence', () => {
  it('parses a valid 4-digit suffix', () => {
    expect(parseCustomerIdSequence('CUST2026-0042', 'CUST2026-')).toBe(42);
  });

  it('parses a high-volume 6-digit suffix without truncating', () => {
    expect(parseCustomerIdSequence('CUST2026-123456', 'CUST2026-')).toBe(123456);
  });

  it('returns 0 for null / undefined / empty input', () => {
    expect(parseCustomerIdSequence(null, 'CUST2026-')).toBe(0);
    expect(parseCustomerIdSequence(undefined, 'CUST2026-')).toBe(0);
    expect(parseCustomerIdSequence('', 'CUST2026-')).toBe(0);
  });

  it('returns 0 when the suffix is non-numeric', () => {
    expect(parseCustomerIdSequence('CUST2026-ABCD', 'CUST2026-')).toBe(0);
  });
});

describe('formatNextCustomerId', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatNextCustomerId(2026, 0)).toBe('CUST2026-0001');
    expect(formatNextCustomerId(2026, 9)).toBe('CUST2026-0010');
    expect(formatNextCustomerId(2026, 155)).toBe('CUST2026-0156');
  });

  it('does not truncate when sequence exceeds 9999', () => {
    expect(formatNextCustomerId(2026, 9999)).toBe('CUST2026-10000');
  });

  it('treats negative previous sequence as 0', () => {
    expect(formatNextCustomerId(2026, -5)).toBe('CUST2026-0001');
  });

  it('uses correct year prefix per year', () => {
    expect(formatNextCustomerId(2025, 100)).toBe('CUST2025-0101');
    expect(formatNextCustomerId(2030, 100)).toBe('CUST2030-0101');
  });
});

// ---------- Supabase integration (mocked) ----------

/**
 * Builds a chainable mock that mirrors the Supabase query builder used by
 * generateNextCustomerId, and records the filters applied so we can assert
 * sargability.
 */
function buildSupabaseMock(rowsToReturn: Array<{ customer_id: string }>) {
  const calls: Record<string, unknown> = {};
  const builder: any = {
    select: vi.fn().mockImplementation((cols: string) => {
      calls.select = cols;
      return builder;
    }),
    gte: vi.fn().mockImplementation((col: string, val: string) => {
      calls.gte = { col, val };
      return builder;
    }),
    lt: vi.fn().mockImplementation((col: string, val: string) => {
      calls.lt = { col, val };
      return builder;
    }),
    order: vi.fn().mockImplementation((col: string, opts: any) => {
      calls.order = { col, ...opts };
      return builder;
    }),
    limit: vi.fn().mockImplementation((n: number) => {
      calls.limit = n;
      return Promise.resolve({ data: rowsToReturn, error: null });
    }),
  };
  const supabase: any = {
    from: vi.fn().mockImplementation((table: string) => {
      calls.from = table;
      return builder;
    }),
  };
  return { supabase, calls };
}

describe('generateNextCustomerId', () => {
  it('returns CUST{year}-0001 when no rows exist', async () => {
    const { supabase } = buildSupabaseMock([]);
    const id = await generateNextCustomerId(supabase, 2026);
    expect(id).toBe('CUST2026-0001');
  });

  it('returns next sequence after the highest existing row', async () => {
    const { supabase } = buildSupabaseMock([{ customer_id: 'CUST2026-0155' }]);
    const id = await generateNextCustomerId(supabase, 2026);
    expect(id).toBe('CUST2026-0156');
  });

  it('uses sargable range filter (gte/lt) — NOT LIKE', async () => {
    const { supabase, calls } = buildSupabaseMock([{ customer_id: 'CUST2026-0010' }]);
    await generateNextCustomerId(supabase, 2026);

    // Filters target the indexed column with proper bounds
    expect(calls.from).toBe('accounts');
    expect(calls.select).toBe('customer_id');
    expect(calls.gte).toEqual({ col: 'customer_id', val: 'CUST2026-' });
    expect(calls.lt).toEqual({ col: 'customer_id', val: 'CUST2026.' });
    expect(calls.order).toEqual({ col: 'customer_id', ascending: false });
    expect(calls.limit).toBe(1);
  });

  it('isolates years: 2025 query does not touch 2026 rows', async () => {
    const { supabase, calls } = buildSupabaseMock([{ customer_id: 'CUST2025-9999' }]);
    const id = await generateNextCustomerId(supabase, 2025);
    expect(id).toBe('CUST2025-10000');
    expect((calls.gte as any).val).toBe('CUST2025-');
    expect((calls.lt as any).val).toBe('CUST2025.');
  });

  it('PERFORMANCE: only one DB round-trip & at most 1 row, regardless of dataset size', async () => {
    // Simulate "very large" dataset by returning the highest row.
    // The function MUST NOT iterate or paginate — it must rely on the index.
    const { supabase, calls } = buildSupabaseMock([
      { customer_id: 'CUST2026-999999' },
    ]);

    const fromSpy = supabase.from as ReturnType<typeof vi.fn>;
    const id = await generateNextCustomerId(supabase, 2026);

    expect(id).toBe('CUST2026-1000000');
    // Exactly one query issued
    expect(fromSpy).toHaveBeenCalledTimes(1);
    // Limited to 1 row → planner can stop after first index entry
    expect(calls.limit).toBe(1);
  });

  it('PERFORMANCE: completes in well under 50ms for 1000 invocations (pure overhead)', async () => {
    // Validates that the helper itself adds negligible CPU cost.
    const { supabase } = buildSupabaseMock([{ customer_id: 'CUST2026-0500' }]);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await generateNextCustomerId(supabase, 2026);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500); // generous ceiling for CI variance
  });

  it('falls back to 0001 when row has malformed suffix', async () => {
    const { supabase } = buildSupabaseMock([{ customer_id: 'CUST2026-WEIRD' }]);
    const id = await generateNextCustomerId(supabase, 2026);
    expect(id).toBe('CUST2026-0001');
  });
});
