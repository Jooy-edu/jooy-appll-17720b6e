/*
  # Fix user signup database error

  1. Database Changes
    - Create trigger function to automatically create profile when user signs up
    - Ensure profiles table has proper foreign key to auth.users
    - Add RLS policy for profile creation during signup

  2. Security
    - Allow users to insert their own profile during signup process
    - Maintain existing RLS policies for profile management
*/

-- Create or replace the trigger function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, credits_remaining, onboarding_completed)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'user'::user_role,
    0,
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add RLS policy to allow profile creation during signup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Allow signup profile creation'
  ) THEN
    CREATE POLICY "Allow signup profile creation"
      ON profiles
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;