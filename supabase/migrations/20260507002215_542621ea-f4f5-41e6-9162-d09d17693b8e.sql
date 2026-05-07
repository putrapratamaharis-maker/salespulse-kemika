
CREATE OR REPLACE FUNCTION public.auto_link_orphan_invoices_on_deal_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.invoices
  SET deal_id = NEW.id
  WHERE deal_id IS NULL
    AND account_id = NEW.account_id
    AND (
      invoice_number = NEW.ar_invoice_number
      OR invoice_number = NEW.po_number
      OR invoice_number = NEW.wms_so_number
      OR invoice_number = NEW.reference_number
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_orphan_invoices ON public.deals;
CREATE TRIGGER trg_auto_link_orphan_invoices
AFTER INSERT OR UPDATE OF po_number, ar_invoice_number, wms_so_number, reference_number
ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_orphan_invoices_on_deal_insert();
