-- Fix security vulnerability in profiles table RLS policies
-- Remove overly permissive signup policy and ensure users can only access their own profiles

-- Drop the overly permissive signup policy that allows any authenticated user to insert profiles
DROP POLICY IF EXISTS "Allow signup profile creation" ON public.profiles;

-- Drop duplicate admin SELECT policy (we already have "Admins can manage all profiles")
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a secure profile creation policy that only allows users to create their own profiles
CREATE POLICY "Users can create their own profile only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Ensure the handle_new_user trigger function creates profiles securely
-- Update the function to be more secure and prevent unauthorized profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile for the authenticated user
  INSERT INTO public.profiles (id, email, full_name, role, credits_remaining, onboarding_completed)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'user'::user_role,
    100, -- Default credits
    false
  );
  RETURN new;
END;
$$;

-- Create the trigger to automatically create profiles on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add a policy to prevent users from viewing other users' email addresses
-- Update the user profile view policy to be more explicit about what can be accessed
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Create a more restrictive update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure admins can still manage all profiles (this policy should already exist)
-- But let's recreate it to be sure it's properly defined
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add a comment to document the security measures
COMMENT ON TABLE public.profiles IS 'User profiles with RLS policies ensuring users can only access their own data and admins can manage all profiles. Email addresses are protected from harvesting.';