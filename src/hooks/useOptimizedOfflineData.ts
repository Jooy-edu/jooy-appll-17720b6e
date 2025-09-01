import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEnhancedOfflineCache } from './useEnhancedOfflineCache';

// Optimized folders hook with aggressive caching
export const useOptimizedOfflineFolders = () => {
  const { user } = useAuth();

  return useEnhancedOfflineCache({
    queryKey: ['optimized-folders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('folders')
        .select(`
          *,
          documents(id, is_private, user_id)
        `)
        .order('name');

      if (error) throw error;

      // Filter folders: user's own folders OR folders with public documents
      const filteredData = data?.filter(folder => 
        folder.user_id === user.id ||
        folder.documents?.some((doc: any) => !doc.is_private)
      ) || [];

      return filteredData;
    },
    enabled: !!user,
    staleTime: 60000, // 1 minute
    maxAge: 5 * 60 * 1000, // 5 minutes
    realtimeTable: 'folders',
  });
};

// Optimized documents hook with aggressive caching
export const useOptimizedOfflineDocuments = (folderId?: string | null) => {
  const { user } = useAuth();

  return useEnhancedOfflineCache({
    queryKey: ['optimized-documents', user?.id, folderId],
    queryFn: async () => {
      if (!user || !folderId) return [];

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId)
        .order('name');

      if (error) throw error;

      // Filter to show user's own documents OR public documents
      const filteredData = data?.filter(doc => 
        doc.user_id === user.id || !doc.is_private
      ) || [];

      return filteredData;
    },
    enabled: !!user && !!folderId,
    staleTime: 60000, // 1 minute  
    maxAge: 5 * 60 * 1000, // 5 minutes
    realtimeTable: 'documents',
    realtimeFilter: folderId ? `folder_id=eq.${folderId}` : undefined,
  });
};

// Optimized worksheet data hook with longer caching
export const useOptimizedOfflineWorksheetData = (documentId?: string) => {
  const { user } = useAuth();

  return useEnhancedOfflineCache({
    queryKey: ['optimized-worksheet-data', documentId],
    queryFn: async () => {
      if (!documentId) return null;

      const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
        body: { documentId }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    maxAge: 30 * 60 * 1000, // 30 minutes - longer for worksheet data
  });
};