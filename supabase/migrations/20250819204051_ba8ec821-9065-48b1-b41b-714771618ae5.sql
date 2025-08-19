-- Create user_level_activations table for level-specific activations
CREATE TABLE public.user_level_activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  activation_code_id UUID NOT NULL REFERENCES public.activation_codes(id),
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one activation per user per folder
  UNIQUE(user_id, folder_id)
);

-- Enable RLS
ALTER TABLE public.user_level_activations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own level activations"
ON public.user_level_activations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own level activations"
ON public.user_level_activations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all level activations"
ON public.user_level_activations
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all level activations"
ON public.user_level_activations
FOR ALL
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_user_level_activations_user_id ON public.user_level_activations(user_id);
CREATE INDEX idx_user_level_activations_folder_id ON public.user_level_activations(folder_id);
CREATE INDEX idx_user_level_activations_expires_at ON public.user_level_activations(access_expires_at);

-- Function to check if user has access to a specific level
CREATE OR REPLACE FUNCTION public.user_has_level_access(user_id_param UUID, folder_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_level_activations
    WHERE user_id = user_id_param
      AND folder_id = folder_id_param
      AND access_expires_at > now()
  );
$$;