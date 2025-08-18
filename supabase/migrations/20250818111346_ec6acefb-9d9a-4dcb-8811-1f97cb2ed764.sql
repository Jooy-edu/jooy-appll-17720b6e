-- Simplify profiles table by removing unnecessary columns
-- Keep only essential fields: id, role, credits_remaining

-- First, let's backup any important data if needed
-- Remove columns that we'll get from auth.users instead
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS full_name,
DROP COLUMN IF EXISTS plan_id,
DROP COLUMN IF EXISTS onboarding_completed,
DROP COLUMN IF EXISTS preferences,
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS updated_at;

-- Update the handle_new_user function to only set essential fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, credits_remaining)
  VALUES (
    new.id, 
    'user'::user_role,
    100 -- Default credits
  );
  RETURN new;
END;
$$;