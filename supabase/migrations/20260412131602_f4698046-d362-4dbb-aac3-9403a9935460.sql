
-- Trigger: when a product is updated, sync deal_products
CREATE OR REPLACE FUNCTION public.sync_deal_products_on_product_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _old_cat_name text;
  _new_cat_name text;
BEGIN
  -- Resolve category names
  SELECT name INTO _old_cat_name FROM public.product_categories WHERE id = OLD.category_id;
  SELECT name INTO _new_cat_name FROM public.product_categories WHERE id = NEW.category_id;

  -- Update deal_products where product_name matches OLD name
  UPDATE public.deal_products
  SET
    product_name = NEW.name,
    category = COALESCE(_new_cat_name, ''),
    unit = COALESCE(NEW.unit, 'pcs'),
    price_per_unit = COALESCE(NEW.selling_price, NEW.price, 0)
  WHERE product_name = OLD.name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_deal_products_on_product_update
AFTER UPDATE ON public.products
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name 
   OR OLD.category_id IS DISTINCT FROM NEW.category_id 
   OR OLD.unit IS DISTINCT FROM NEW.unit
   OR OLD.selling_price IS DISTINCT FROM NEW.selling_price)
EXECUTE FUNCTION public.sync_deal_products_on_product_update();

-- Trigger: when a category name changes, sync deal_products
CREATE OR REPLACE FUNCTION public.sync_deal_products_on_category_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.deal_products
  SET category = NEW.name
  WHERE category = OLD.name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_deal_products_on_category_update
AFTER UPDATE ON public.product_categories
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.sync_deal_products_on_category_update();
