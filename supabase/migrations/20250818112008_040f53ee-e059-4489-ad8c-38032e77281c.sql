-- Add back the removed columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN email TEXT,
ADD COLUMN full_name TEXT,
ADD COLUMN plan_id UUID,
ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN preferences JSONB,
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Update the handle_new_user function to populate these fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, credits_remaining, onboarding_completed)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'user'::user_role,
    100, -- Default credits
    false
  );
  RETURN new;
END;
$$;