import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { backgroundSyncService } from '@/utils/backgroundSyncService';
import { getOfflineUser } from '@/utils/offlineAuth';

export const useOfflineFolders = () => {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      // Always try offline data first for immediate UI
      const cachedFolders = await documentStore.getFolders();
      
      // If we have cached data, return it immediately and sync in background
      if (cachedFolders.length > 0) {
        const { user } = await getOfflineUser();
        const processedData = cachedFolders
          .map(cached => cached.data)
          .filter(folder => 
            folder.user_id === user?.id || 
            folder.documents?.some((doc: any) => !doc.is_private)
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        // Trigger background sync for updates (don't await)
        backgroundSyncService.syncFolders().catch(console.error);
        
        return processedData;
      }

      // No cached data - try to fetch from server if online
      if (!backgroundSyncService.isOffline()) {
        try {
          const { user } = await getOfflineUser();
          
          const { data, error } = await supabase
            .from('folders')
            .select(`
              *,
              documents(id, is_private, user_id)
            `)
            .order('name');

          if (error) throw error;

          const filteredData = data?.filter(folder => 
            folder.user_id === user?.id ||
            folder.documents?.some((doc: any) => !doc.is_private)
          ) || [];

          // Cache the fresh data for future offline use
          if (filteredData.length > 0) {
            await documentStore.saveFolders(filteredData, Date.now());
          }

          return filteredData;
        } catch (error) {
          console.error('Failed to fetch folders from server:', error);
          return [];
        }
      }

      // Offline with no cached data
      return [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - standardized cache duration
    refetchOnMount: false, // Rely on cache first
    refetchOnWindowFocus: false, // Background service handles this
    refetchInterval: false, // Disable automatic refetching
  });
};