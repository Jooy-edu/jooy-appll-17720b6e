import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheCoordinator } from '@/utils/cacheCoordinator';

/**
 * Hook to sync storage changes across all cover images
 * This provides global storage event handling for all covers
 */
export const useStorageRealtimeSync = () => {
  useEffect(() => {
    // Subscribe to all storage object changes in covers bucket
    const channel = supabase
      .channel('storage-covers-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'storage',
          table: 'objects',
          filter: 'bucket_id=eq.covers'
        },
        async (payload) => {
          console.log('Global storage change detected:', payload);
          
          const { old: oldRecord, new: newRecord, eventType } = payload;
          const record = newRecord || oldRecord;
          
          if (record && typeof record === 'object' && 'name' in record && record.name) {
            // Extract document ID from filename (e.g., "ABC123.jpg" -> "ABC123")
            const documentId = (record.name as string).split('.')[0];
            
            if (documentId) {
              await cacheCoordinator.invalidateCache({
                type: 'cover',
                id: documentId,
                action: eventType === 'DELETE' ? 'delete' : 'update',
                cascadeKeys: [`document_${documentId}`, 'folders']
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};