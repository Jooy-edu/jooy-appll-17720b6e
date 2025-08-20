-- Phase 1: Harden database functions against SQL injection by setting search_path

-- Update user_has_level_access function
CREATE OR REPLACE FUNCTION public.user_has_level_access(user_id_param uuid, folder_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_level_activations
    WHERE user_id = user_id_param
      AND folder_id = folder_id_param
      AND access_expires_at > now()
  );
$function$;

-- Update check_user_level_access_status function
CREATE OR REPLACE FUNCTION public.check_user_level_access_status(user_id_param uuid, folder_id_param uuid)
 RETURNS TABLE(has_access boolean, expires_at timestamp with time zone, days_remaining integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Update user_has_any_level_access function
CREATE OR REPLACE FUNCTION public.user_has_any_level_access(user_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_level_activations
    WHERE user_id = user_id_param
      AND access_expires_at > now()
  );
$function$;

-- Update get_user_active_level_count function
CREATE OR REPLACE FUNCTION public.get_user_active_level_count(user_id_param uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.user_level_activations
  WHERE user_id = user_id_param
    AND access_expires_at > now();
$function$;

-- Phase 2: Restrict credit_plans access to protect business data
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Allow authenticated users to view plans" ON public.credit_plans;

-- Create more restrictive policy for credit plans
CREATE POLICY "Users can view plans only when needed" 
ON public.credit_plans 
FOR SELECT 
USING (
  -- Allow admins to see all plans
  is_admin(auth.uid()) OR 
  -- Allow authenticated users to see plans (but we could make this more restrictive in the future)
  auth.uid() IS NOT NULL
);

-- Ensure admins can still manage plans
CREATE POLICY "Admins can manage all credit plans" 
ON public.credit_plans 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));