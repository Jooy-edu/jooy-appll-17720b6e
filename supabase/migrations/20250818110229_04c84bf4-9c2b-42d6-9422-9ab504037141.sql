-- Update RLS policies to allow access to public documents and folders containing public documents

-- Drop existing restrictive policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Admins can read all documents" ON documents;

-- Create new policies for public document access
CREATE POLICY "Users can view public documents or their own documents" 
ON documents 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (is_private = false AND auth.uid() IS NOT NULL) OR
  is_admin(auth.uid())
);

-- Update folders policy to allow viewing folders that contain public documents
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;

CREATE POLICY "Users can view folders with public documents or their own folders" 
ON folders 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (
    auth.uid() IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.folder_id = folders.id AND d.is_private = false
    )
  ) OR
  is_admin(auth.uid())
);