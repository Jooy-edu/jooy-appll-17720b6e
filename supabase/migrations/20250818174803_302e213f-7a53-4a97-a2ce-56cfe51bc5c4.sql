-- Add FATOY document to documents table using the current authenticated user
INSERT INTO public.documents (id, name, user_id, is_private, metadata, drm_protected_pages)
VALUES (
  'FATOY',
  'FATOY Worksheet',
  '14a9f66f-0de2-45c4-bbc5-d1fa8fc0fcef', -- Current user ID from network requests
  false, -- Make it public
  NULL, -- No auto mode metadata, will use regions mode
  '[]'::jsonb -- No DRM protected pages
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_private = EXCLUDED.is_private,
  metadata = EXCLUDED.metadata,
  drm_protected_pages = EXCLUDED.drm_protected_pages;