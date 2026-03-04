-- Allow users to delete their own accounts
CREATE POLICY "Users can delete own accounts"
ON public.accounts
FOR DELETE
USING (auth.uid() = sales_id);
