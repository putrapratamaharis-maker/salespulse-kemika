-- Change deals.value from bigint to numeric to support decimal values
ALTER TABLE public.deals ALTER COLUMN value TYPE numeric USING value::numeric;

-- Change invoices.net_sales and gross_profit from bigint to numeric
ALTER TABLE public.invoices ALTER COLUMN net_sales TYPE numeric USING net_sales::numeric;
ALTER TABLE public.invoices ALTER COLUMN gross_profit TYPE numeric USING gross_profit::numeric;