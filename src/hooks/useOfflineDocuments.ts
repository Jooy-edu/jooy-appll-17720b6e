import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { backgroundSyncService } from '@/utils/backgroundSyncService';

export const useOfflineDocuments = (folderId?: string) => {
  return useQuery({
    queryKey: ['documents', folderId],
    queryFn: async () => {
      // Always try offline data first for immediate UI
      const cachedDocs = await documentStore.getDocuments(folderId);
      
      // If we have cached data, return it immediately
      if (cachedDocs.length > 0) {
        // Trigger background sync for updates
        backgroundSyncService.syncDocuments();
        
        // Return cached data processed for the UI
        const { data: user } = await supabase.auth.getUser();
        return cachedDocs
          .map(cached => cached.data)
          .filter(doc => 
            doc.user_id === user.user?.id || !doc.is_private
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // No cached data - try to fetch from server
      if (!backgroundSyncService.isOffline()) {
        try {
          const { data: user } = await supabase.auth.getUser();
          
          const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('folder_id', folderId!)
            .order('name');

          if (error) throw error;

          const filteredData = data?.filter(doc => 
            doc.user_id === user.user?.id || !doc.is_private
          ) || [];

          // Cache the fresh data for future offline use
          if (filteredData.length > 0) {
            await documentStore.saveDocuments(filteredData, Date.now());
          }

          return filteredData;
        } catch (error) {
          console.error('Failed to fetch documents from server:', error);
          // Return empty array if both cache and server fail
          return [];
        }
      }

      // Offline with no cached data
      return [];
    },
    enabled: !!folderId,
    staleTime: 2 * 60 * 1000, // 2 minutes - standardized cache duration
    refetchOnMount: false, // Don't refetch on mount - rely on cache
    refetchOnWindowFocus: false, // Background service handles this
  });
};