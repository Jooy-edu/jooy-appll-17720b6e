-- Fix critical security vulnerability in profiles table
-- Drop existing policies that may have loopholes
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile only" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile only" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile only" ON profiles;

-- Create new secure RLS policies
-- Only allow users to view their own profile
CREATE POLICY "Users can only view their own profile" ON profiles
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Only allow users to update their own profile
CREATE POLICY "Users can only update their own profile" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Only allow users to insert their own profile (during signup)
CREATE POLICY "Users can only create their own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow admins to manage all profiles (separate policy for clarity)
CREATE POLICY "Admins can manage all profiles" ON profiles
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (critical security setting)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;