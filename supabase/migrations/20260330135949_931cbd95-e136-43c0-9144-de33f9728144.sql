-- Allow users to insert their own deals
CREATE POLICY "Users can insert own deals"
ON public.deals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sales_id);

-- Allow users to update their own deals
CREATE POLICY "Users can update own deals"
ON public.deals FOR UPDATE
TO authenticated
USING (auth.uid() = sales_id);

-- Allow users to delete their own deals
CREATE POLICY "Users can delete own deals"
ON public.deals FOR DELETE
TO authenticated
USING (auth.uid() = sales_id);