-- Fix activation code storage format - remove hyphens for consistency
-- This ensures the query logic matches the storage format

-- Update existing activation codes to remove hyphens
UPDATE activation_codes 
SET code = REPLACE(code, '-', '');

-- Create index for better performance on code lookups
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);

-- Update the level activation logic to be more robust
-- Also add a function to check if user already has access to prevent redundant activations
CREATE OR REPLACE FUNCTION public.check_user_level_access_status(
    user_id_param uuid, 
    folder_id_param uuid
) 
RETURNS TABLE(
    has_access boolean,
    expires_at timestamp with time zone,
    days_remaining integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT 
        CASE 
            WHEN ula.access_expires_at IS NOT NULL AND ula.access_expires_at > now() 
            THEN true 
            ELSE false 
        END as has_access,
        ula.access_expires_at,
        CASE 
            WHEN ula.access_expires_at IS NOT NULL AND ula.access_expires_at > now()
            THEN EXTRACT(days FROM (ula.access_expires_at - now()))::integer
            ELSE 0
        END as days_remaining
    FROM user_level_activations ula
    WHERE ula.user_id = user_id_param 
      AND ula.folder_id = folder_id_param
    LIMIT 1;
$$;