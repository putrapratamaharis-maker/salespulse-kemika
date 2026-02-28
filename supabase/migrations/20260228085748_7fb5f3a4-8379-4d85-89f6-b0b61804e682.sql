
CREATE POLICY "Users can delete own activities"
ON public.sales_activities
FOR DELETE
USING (auth.uid() = sales_id);
