/*
  # Fix user signup database trigger

  1. Database Functions
    - Create or replace `handle_new_user()` function to automatically create profiles
    - Function extracts user data from auth.users and creates corresponding profile

  2. Database Triggers
    - Create trigger `on_auth_user_created` on auth.users table
    - Trigger fires after INSERT to automatically call handle_new_user()

  3. Security
    - Ensure RLS policies allow profile creation during signup process
    - Update existing policies to handle trigger-based insertions

  This fixes the "Database error saving new user" issue by ensuring profiles
  are automatically created when users sign up through Supabase Auth.
*/

-- Create or replace the function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    credits_remaining,
    onboarding_completed,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user'::user_role,
    0,
    false,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure there's a policy that allows the trigger to insert profiles
DO $$
BEGIN
  -- Check if the policy exists, if not create it
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