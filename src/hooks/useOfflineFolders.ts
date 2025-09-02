import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { backgroundSyncService } from '@/utils/backgroundSyncService';

export const useOfflineFolders = () => {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      // Always try offline data first for immediate UI
      const cachedFolders = await documentStore.getFolders();
      
      // If we have cached data, return it immediately
      if (cachedFolders.length > 0) {
        // Trigger background sync for updates
        backgroundSyncService.syncFolders();
        
        // Return cached data processed for the UI
        const { data: user } = await supabase.auth.getUser();
        return cachedFolders
          .map(cached => cached.data)
          .filter(folder => 
            folder.user_id === user.user?.id || 
            folder.documents?.some((doc: any) => !doc.is_private)
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // No cached data - try to fetch from server
      if (!backgroundSyncService.isOffline()) {
        try {
          const { data: user } = await supabase.auth.getUser();
          
          const { data, error } = await supabase
            .from('folders')
            .select(`
              *,
              documents(id, is_private, user_id)
            `)
            .order('name');

          if (error) throw error;

          const filteredData = data?.filter(folder => 
            folder.user_id === user.user?.id ||
            folder.documents?.some((doc: any) => !doc.is_private)
          ) || [];

          // Cache the fresh data for future offline use
          if (filteredData.length > 0) {
            await documentStore.saveFolders(filteredData, Date.now());
          }

          return filteredData;
        } catch (error) {
          console.error('Failed to fetch folders from server:', error);
          // Return empty array if both cache and server fail
          return [];
        }
      }

      // Offline with no cached data
      return [];
    },
    staleTime: 1000, // Always consider stale to allow background updates
    refetchOnMount: false, // Don't refetch on mount - rely on cache
    refetchOnWindowFocus: false, // Background service handles this
  });
};