-- Migration: Remove global activation system and use only level-specific activations

-- Step 1: For users who have level activations but no global activation, 
-- we'll update their profile to be activated to maintain access
UPDATE profiles 
SET jooy_app_activated = true 
WHERE id IN (
  SELECT DISTINCT user_id 
  FROM user_level_activations 
  WHERE access_expires_at > now()
) AND jooy_app_activated = false;

-- Step 2: Create a function to check if user has any level access
CREATE OR REPLACE FUNCTION public.user_has_any_level_access(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_level_activations
    WHERE user_id = user_id_param
      AND access_expires_at > now()
  );
$function$;

-- Step 3: Create a function to get user's active level count
CREATE OR REPLACE FUNCTION public.get_user_active_level_count(user_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT COUNT(*)::integer
  FROM public.user_level_activations
  WHERE user_id = user_id_param
    AND access_expires_at > now();
$function$;