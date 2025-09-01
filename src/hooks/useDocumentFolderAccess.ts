import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLevelAccess } from './useLevelAccess';

interface DocumentFolderAccess {
  requiresLevelAccess: boolean;
  folderId: string | null;
  hasAccess: boolean;
  isLoading: boolean;
  error: Error | null;
}

export const useDocumentFolderAccess = (documentId?: string): DocumentFolderAccess => {
  const { user } = useAuth();

  // First, get the document's folder_id
  const { data: documentData, isLoading: documentLoading, error: documentError } = useQuery({
    queryKey: ['document-folder', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      
      const { data, error } = await supabase
        .from('documents')
        .select('folder_id')
        .eq('id', documentId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!documentId && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Then check level access if document has a folder
  const { data: levelAccess, isLoading: levelLoading, error: levelError } = useLevelAccess(
    documentData?.folder_id || null
  );

  // Combine the results
  const folderId = documentData?.folder_id || null;
  const requiresLevelAccess = !!folderId; // Document requires level access if it has a folder_id
  const hasAccess = requiresLevelAccess ? (levelAccess?.isActivated || false) : true; // No folder = always has access
  const isLoading = documentLoading || (requiresLevelAccess && levelLoading);
  const error = documentError || levelError;

  return {
    requiresLevelAccess,
    folderId,
    hasAccess,
    isLoading,
    error
  };
};