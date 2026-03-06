
-- Add missing values to deal_stage enum
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'quotation';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'po_secured';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'invoice_issued';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'canceled';
ALTER TYPE public.deal_stage ADD VALUE IF NOT EXISTS 'lost';
