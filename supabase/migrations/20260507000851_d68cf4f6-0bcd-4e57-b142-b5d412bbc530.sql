CREATE OR REPLACE FUNCTION public.auto_link_invoice_to_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deal_id uuid;
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.id INTO _deal_id
  FROM public.deals d
  WHERE d.ar_invoice_number = NEW.invoice_number
     OR d.po_number = NEW.invoice_number
     OR d.wms_so_number = NEW.invoice_number
     OR d.reference_number = NEW.invoice_number
  ORDER BY (d.ar_invoice_number = NEW.invoice_number) DESC,
           (d.po_number = NEW.invoice_number) DESC
  LIMIT 1;

  IF _deal_id IS NOT NULL THEN
    NEW.deal_id := _deal_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_invoice_to_deal ON public.invoices;
CREATE TRIGGER trg_auto_link_invoice_to_deal
BEFORE INSERT OR UPDATE OF invoice_number ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_invoice_to_deal();