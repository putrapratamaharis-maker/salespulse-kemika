-- 1. Add deal_id linkage to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deal_id uuid;

-- 2. Backfill deal_id from existing identifiers (best-effort match by invoice_number)
UPDATE public.invoices i
SET deal_id = d.id
FROM public.deals d
WHERE i.deal_id IS NULL
  AND (
    d.ar_invoice_number = i.invoice_number
    OR d.po_number = i.invoice_number
    OR d.wms_so_number = i.invoice_number
    OR d.reference_number = i.invoice_number
  );

-- 3. Cleanup: delete invoices whose linked deal was deleted, canceled, or lost
DELETE FROM public.invoices i
WHERE i.deal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = i.deal_id
      AND d.stage NOT IN ('canceled'::deal_stage, 'lost'::deal_stage, 'closed_lost'::deal_stage)
  );

-- 4. Foreign key with cascade delete
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_deal_id_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON public.invoices(deal_id);

-- 5. Trigger: when deal stage moves to canceled / lost, drop its invoices
CREATE OR REPLACE FUNCTION public.cleanup_invoices_on_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('canceled'::deal_stage, 'lost'::deal_stage, 'closed_lost'::deal_stage)
     AND (OLD.stage IS DISTINCT FROM NEW.stage)
  THEN
    DELETE FROM public.invoices WHERE deal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_invoices_on_deal_stage_change ON public.deals;
CREATE TRIGGER trg_cleanup_invoices_on_deal_stage_change
AFTER UPDATE OF stage ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_invoices_on_deal_stage_change();