-- Fix remaining security linter warnings
-- Update functions to have proper search_path settings

-- Fix function search path for create_admin_user function
CREATE OR REPLACE FUNCTION public.create_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@jooy.io' LIMIT 1;
  
  IF admin_id IS NULL THEN
    RAISE NOTICE 'No admin user found with email admin@jooy.io';
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (admin_id, 'admin@jooy.io', 'Administrator', 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  END IF;
END;
$$;

-- Fix function search path for is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- Fix function search path for is_owner function
CREATE OR REPLACE FUNCTION public.is_owner(user_id uuid, requested_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN user_id = requested_user_id;
END;
$$;

-- Fix function search path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;