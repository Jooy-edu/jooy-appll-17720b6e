-- Add FATOY document to documents table
INSERT INTO public.documents (id, name, user_id, is_private, metadata, drm_protected_pages)
VALUES (
  'FATOY',
  'FATOY Worksheet',
  '00000000-0000-0000-0000-000000000000', -- Admin user
  false, -- Make it public
  NULL, -- No auto mode metadata, will use regions mode
  '[]'::jsonb -- No DRM protected pages
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_private = EXCLUDED.is_private,
  metadata = EXCLUDED.metadata,
  drm_protected_pages = EXCLUDED.drm_protected_pages;