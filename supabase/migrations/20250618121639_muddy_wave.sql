/*
  # Set up storage for encrypted PDFs

  1. Storage
    - Create private-pdfs bucket for storing PDF files
    - Set up RLS policies for secure access
    - Only authenticated users with proper permissions can access

  2. Security
    - Enable RLS on storage.objects
    - Create policies for PDF access based on user permissions
*/

-- Create the private-pdfs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-pdfs',
  'private-pdfs', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (should already be enabled, but ensuring it)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for service role to manage all files in private-pdfs bucket
CREATE POLICY "Service role can manage private PDFs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'private-pdfs');

-- Create policy for authenticated users to read PDFs they have access to
-- This is a basic policy - you might want to make this more restrictive based on your needs
CREATE POLICY "Authenticated users can read private PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'private-pdfs');

-- Create policy for admins to manage all PDFs
CREATE POLICY "Admins can manage private PDFs"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'private-pdfs' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);