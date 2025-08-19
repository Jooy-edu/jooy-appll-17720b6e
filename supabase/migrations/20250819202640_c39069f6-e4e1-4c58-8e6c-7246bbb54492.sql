-- Add RLS policy to allow authenticated users to read active activation codes for validation
CREATE POLICY "Allow authenticated users to read active codes for validation" 
ON public.activation_codes 
FOR SELECT 
TO authenticated 
USING (is_active = true);