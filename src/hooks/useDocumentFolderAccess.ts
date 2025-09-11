import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLevelAccess } from './useLevelAccess';
import { documentStore } from '@/utils/documentStore';

interface DocumentFolderAccess {
  requiresLevelAccess: boolean;
  folderId: string | null;
  hasAccess: boolean;
  isLoading: boolean;
  error: Error | null;
}

export const useDocumentFolderAccess = (documentId?: string): DocumentFolderAccess => {
  const { user } = useAuth();

  // First, get the document's folder_id and check if it requires activation
  const { data: documentData, isLoading: documentLoading, error: documentError } = useQuery({
    queryKey: ['document-folder-access', documentId],
    queryFn: async () => {
      if (!documentId) {
        console.log('useDocumentFolderAccess: No documentId provided');
        return { folder_id: null, requiresLevelAccess: false };
      }
      
      try {
        // Try cache first
        const cachedDoc = await documentStore.getDocumentById(documentId);
        if (cachedDoc?.data) {
          const folderId = cachedDoc.data.folder_id;
          console.log('useDocumentFolderAccess: Found cached document', { documentId, folderId });
          
          if (!folderId) {
            return { folder_id: null, requiresLevelAccess: false };
          }
          
          // Check if folder belongs to books@jooy.io
          const requiresActivation = await checkFolderRequiresActivation(folderId);
          return { folder_id: folderId, requiresLevelAccess: requiresActivation };
        }
        
        // Fallback to Supabase if online and not cached
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('folder_id')
          .eq('id', documentId)
          .maybeSingle();

        if (docError) {
          console.log('useDocumentFolderAccess: Document query error (defaulting to no activation):', docError);
          return { folder_id: null, requiresLevelAccess: false };
        }

        if (!docData || !docData.folder_id) {
          console.log('useDocumentFolderAccess: Document not found or no folder (no activation required)');
          return { folder_id: null, requiresLevelAccess: false };
        }

        // Check if folder belongs to books@jooy.io
        const requiresActivation = await checkFolderRequiresActivation(docData.folder_id);
        console.log('useDocumentFolderAccess: Document found', { 
          documentId, 
          folderId: docData.folder_id, 
          requiresActivation 
        });
        
        return { folder_id: docData.folder_id, requiresLevelAccess: requiresActivation };
      } catch (error) {
        console.log('useDocumentFolderAccess: Unexpected error (defaulting to no activation):', error);
        return { folder_id: null, requiresLevelAccess: false };
      }
    },
    enabled: !!documentId && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Helper function to check if folder requires activation
  const checkFolderRequiresActivation = async (folderId: string): Promise<boolean> => {
    try {
      // Get folder owner
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('user_id')
        .eq('id', folderId)
        .maybeSingle();

      if (folderError || !folderData) {
        console.log('useDocumentFolderAccess: Folder not found (no activation required):', folderError);
        return false;
      }

      // Get owner's email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', folderData.user_id)
        .maybeSingle();

      if (profileError || !profileData) {
        console.log('useDocumentFolderAccess: Profile not found (no activation required):', profileError);
        return false;
      }

      const requiresActivation = profileData.email === 'books@jooy.io';
      console.log('useDocumentFolderAccess: Folder owner check', { 
        folderId, 
        ownerEmail: profileData.email, 
        requiresActivation 
      });
      
      return requiresActivation;
    } catch (error) {
      console.log('useDocumentFolderAccess: Error checking folder owner (defaulting to no activation):', error);
      return false;
    }
  };

  // Then check level access only if document requires activation
  const shouldCheckLevelAccess = documentData?.requiresLevelAccess && documentData?.folder_id;
  const { data: levelAccess, isLoading: levelLoading, error: levelError } = useLevelAccess(
    shouldCheckLevelAccess ? documentData.folder_id : null
  );

  // Combine the results
  const folderId = documentData?.folder_id || null;
  const requiresLevelAccess = documentData?.requiresLevelAccess || false;
  const hasAccess = requiresLevelAccess ? (levelAccess?.isActivated || false) : true;
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