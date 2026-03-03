-- Allow authenticated users to insert their own accounts
CREATE POLICY "Users can insert own accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sales_id);

-- Allow users to update their own accounts
CREATE POLICY "Users can update own accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = sales_id);