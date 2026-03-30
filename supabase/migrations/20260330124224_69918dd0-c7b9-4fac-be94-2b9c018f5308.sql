
CREATE POLICY "Users can update own invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (auth.uid() = sales_id);

CREATE POLICY "Users can delete own invoices"
ON public.invoices FOR DELETE TO authenticated
USING (auth.uid() = sales_id);

CREATE POLICY "Users can insert own invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sales_id);
