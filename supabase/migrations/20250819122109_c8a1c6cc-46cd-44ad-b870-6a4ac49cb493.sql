-- Fix profiles table RLS policies to prevent any potential email harvesting
-- First, drop existing policies to recreate them with stricter conditions
DROP POLICY IF EXISTS "Users can view their own profile only" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile only" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile only" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create much stricter policies that explicitly check authentication
-- Policy for SELECT: Users can only view their own profile
CREATE POLICY "Strict profile select policy" 
ON profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    (auth.uid() = id) 
    OR 
    is_admin(auth.uid())
  )
);

-- Policy for INSERT: Users can only create their own profile
CREATE POLICY "Strict profile insert policy" 
ON profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = id
);

-- Policy for UPDATE: Users can only update their own profile or admins can update any
CREATE POLICY "Strict profile update policy" 
ON profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    (auth.uid() = id) 
    OR 
    is_admin(auth.uid())
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    (auth.uid() = id) 
    OR 
    is_admin(auth.uid())
  )
);

-- Policy for DELETE: Only admins can delete profiles
CREATE POLICY "Admin only profile delete policy" 
ON profiles 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND is_admin(auth.uid())
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (important security measure)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;