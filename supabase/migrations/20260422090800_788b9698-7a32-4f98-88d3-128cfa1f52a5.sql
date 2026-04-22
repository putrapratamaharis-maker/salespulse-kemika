ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS ar_invoice_number text,
  ADD COLUMN IF NOT EXISTS ar_invoice_date date,
  ADD COLUMN IF NOT EXISTS ar_invoice_amount numeric,
  ADD COLUMN IF NOT EXISTS ar_due_date date,
  ADD COLUMN IF NOT EXISTS ar_paid_date date,
  ADD COLUMN IF NOT EXISTS ar_paid_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ar_status text,
  ADD COLUMN IF NOT EXISTS ar_last_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_deals_wms_so_number ON public.deals (wms_so_number) WHERE wms_so_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_ar_invoice_number ON public.deals (ar_invoice_number) WHERE ar_invoice_number IS NOT NULL;