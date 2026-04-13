
CREATE OR REPLACE FUNCTION public.sync_deal_products_on_product_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_cat_name text;
BEGIN
  SELECT name INTO _new_cat_name FROM public.product_categories WHERE id = NEW.category_id;

  UPDATE public.deal_products
  SET
    product_name = NEW.name,
    category = COALESCE(_new_cat_name, ''),
    unit = COALESCE(NEW.unit, 'pcs')
  WHERE product_name = OLD.name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_products_on_product_update ON public.products;

CREATE TRIGGER trg_sync_deal_products_on_product_update
AFTER UPDATE ON public.products
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name 
   OR OLD.category_id IS DISTINCT FROM NEW.category_id 
   OR OLD.unit IS DISTINCT FROM NEW.unit)
EXECUTE FUNCTION public.sync_deal_products_on_product_update();
