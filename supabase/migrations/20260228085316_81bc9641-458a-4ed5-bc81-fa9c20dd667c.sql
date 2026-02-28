
CREATE POLICY "Users can insert own activities"
ON public.sales_activities
FOR INSERT
WITH CHECK (auth.uid() = sales_id);

CREATE POLICY "Users can update own activities"
ON public.sales_activities
FOR UPDATE
USING (auth.uid() = sales_id);
