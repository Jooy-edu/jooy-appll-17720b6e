-- Migration to fix dual activation system and populate level activations for existing users

-- First, let's populate user_level_activations for existing activated users
-- This will give all activated users access to all existing levels
INSERT INTO public.user_level_activations (
    user_id,
    folder_id,
    activation_code_id,
    access_expires_at
)
SELECT 
    p.id as user_id,
    f.id as folder_id,
    ac.id as activation_code_id,
    (NOW() + INTERVAL '1 year') as access_expires_at
FROM public.profiles p
CROSS JOIN public.folders f
CROSS JOIN (
    SELECT id 
    FROM public.activation_codes 
    WHERE is_active = true 
    LIMIT 1
) ac
WHERE p.jooy_app_activated = true
ON CONFLICT (user_id, folder_id) DO NOTHING;

-- Update the user_has_level_access function to be more robust
CREATE OR REPLACE FUNCTION public.user_has_level_access(user_id_param uuid, folder_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_level_activations
    WHERE user_id = user_id_param
      AND folder_id = folder_id_param
      AND access_expires_at > now()
  );
$$;