-- Remove the insecure RLS policy that allows all authenticated users to read activation codes
DROP POLICY IF EXISTS "Allow authenticated users to read active codes for validation" ON public.activation_codes;

-- Create a secure function to validate activation codes without exposing them
CREATE OR REPLACE FUNCTION public.validate_activation_code(code_input text)
RETURNS TABLE(
  code_id uuid,
  is_valid boolean,
  expires_at timestamp with time zone,
  max_uses integer,
  app_access_duration_days integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_data record;
  usage_count integer;
BEGIN
  -- Clean and validate the input code format
  code_input := trim(code_input);
  
  -- Check if code exists and is active
  SELECT ac.id, ac.is_active, ac.expires_at, ac.max_uses, ac.app_access_duration_days
  INTO code_data
  FROM activation_codes ac
  WHERE ac.code = code_input AND ac.is_active = true;
  
  -- Code not found or inactive
  IF NOT FOUND OR NOT code_data.is_active THEN
    RETURN QUERY SELECT 
      NULL::uuid as code_id,
      false as is_valid,
      NULL::timestamp with time zone as expires_at,
      NULL::integer as max_uses,
      NULL::integer as app_access_duration_days,
      'Invalid or expired activation code'::text as error_message;
    RETURN;
  END IF;
  
  -- Check if code has expired
  IF code_data.expires_at IS NOT NULL AND code_data.expires_at < now() THEN
    RETURN QUERY SELECT 
      NULL::uuid as code_id,
      false as is_valid,
      NULL::timestamp with time zone as expires_at,
      NULL::integer as max_uses,
      NULL::integer as app_access_duration_days,
      'Activation code has expired'::text as error_message;
    RETURN;
  END IF;
  
  -- Check usage limit
  SELECT COUNT(*) INTO usage_count
  FROM user_level_activations
  WHERE activation_code_id = code_data.id;
  
  IF usage_count >= code_data.max_uses THEN
    RETURN QUERY SELECT 
      NULL::uuid as code_id,
      false as is_valid,
      NULL::timestamp with time zone as expires_at,
      NULL::integer as max_uses,
      NULL::integer as app_access_duration_days,
      'Activation code has reached maximum usage limit'::text as error_message;
    RETURN;
  END IF;
  
  -- Code is valid
  RETURN QUERY SELECT 
    code_data.id as code_id,
    true as is_valid,
    code_data.expires_at,
    code_data.max_uses,
    code_data.app_access_duration_days,
    NULL::text as error_message;
END;
$$;

-- Create a more restrictive RLS policy for activation_codes
-- Only admins can directly access activation codes
CREATE POLICY "Only admins can access activation codes directly"
ON public.activation_codes
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));