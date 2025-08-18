-- Backfill existing user emails and full names from auth.users to profiles table
UPDATE public.profiles 
SET 
  email = COALESCE(profiles.email, auth_users.email),
  full_name = COALESCE(profiles.full_name, auth_users.raw_user_meta_data->>'full_name', auth_users.raw_user_meta_data->>'name')
FROM auth.users auth_users
WHERE profiles.id = auth_users.id
  AND (profiles.email IS NULL OR profiles.full_name IS NULL);

-- Update handle_new_user function to better handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, credits_remaining, onboarding_completed)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    'user'::user_role,
    100,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END;
$$;