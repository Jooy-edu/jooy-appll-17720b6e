import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { intelligentCache } from '@/utils/intelligentCacheManager';
import { useAuth } from '@/contexts/AuthContext';

interface IntelligentDataOptions<T> {
  queryKey: (string | null)[];
  queryFn: () => Promise<T>;
  category: string;
  enabled?: boolean;
  dependencies?: string[];
  realtimeTable?: string;
  realtimeFilter?: string;
  preloadRelated?: boolean;
}

// Enhanced hook with intelligent caching and sync
export const useIntelligentData = <T>(options: IntelligentDataOptions<T>) => {
  const {
    queryKey,
    queryFn,
    category,
    enabled = true,
    dependencies = [],
    realtimeTable,
    realtimeFilter,
    preloadRelated = false
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFromCache, setIsFromCache] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'stale' | 'offline'>('fresh');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const cacheKey = queryKey.filter(Boolean).join('_');

  // Load from intelligent cache first
  useEffect(() => {
    if (!enabled || !cacheKey) return;
    
    const loadFromCache = async () => {
      const cachedData = await intelligentCache.getIntelligent<T>(category, cacheKey);
      if (cachedData) {
        setIsFromCache(true);
        setCacheStatus('fresh');
        queryClient.setQueryData(queryKey, cachedData);
      }
    };
    
    loadFromCache();
  }, [cacheKey, enabled, category, queryClient, queryKey]);

  // Main query with intelligent caching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const data = await queryFn();
        
        // Store in intelligent cache with metadata
        await intelligentCache.setIntelligent(category, cacheKey, data, {
          dependencies,
          version: '1.0'
        });

        // Trigger related preloading if enabled
        if (preloadRelated) {
          await intelligentCache.preloadRelated(category, cacheKey, { 
            userId: user?.id,
            currentData: data 
          });
        }

        setIsFromCache(false);
        setCacheStatus('fresh');
        return data;
      } catch (error) {
        // On network error, try to serve stale cache
        if (!isOnline) {
          const staleData = await intelligentCache.getIntelligent<T>(category, cacheKey);
          if (staleData) {
            setCacheStatus('stale');
            return staleData;
          }
        }
        throw error;
      }
    },
    enabled: enabled && isOnline,
    staleTime: intelligentCache.getNetworkSpeed() === 'fast' ? 30000 : 60000,
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!isOnline) return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Online/offline status management
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refetch when back online if we were serving stale data
      if (cacheStatus === 'stale' || cacheStatus === 'offline') {
        query.refetch();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setCacheStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [cacheStatus, query]);

  // Enhanced realtime subscription with intelligent invalidation
  useEffect(() => {
    if (!realtimeTable || !enabled) return;

    const channel = supabase
      .channel(`${realtimeTable}-intelligent-${cacheKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: realtimeTable,
          filter: realtimeFilter
        },
        async (payload) => {
          // Intelligent cache invalidation based on change type
          if (payload.eventType === 'DELETE') {
            // More aggressive invalidation for deletes
            await intelligentCache.invalidateWithDependencies(category, cacheKey);
          } else {
            // For updates/inserts, we can be more selective
            const affectsCurrentData = await shouldInvalidateForPayload(payload, queryKey);
            if (affectsCurrentData) {
              await intelligentCache.invalidateWithDependencies(category, cacheKey);
            }
          }
          
          // Invalidate React Query cache
          queryClient.invalidateQueries({ queryKey });
          
          // Refetch if online
          if (isOnline) {
            query.refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, realtimeFilter, cacheKey, queryClient, queryKey, query, isOnline, enabled, category]);

  // Force refresh function
  const refresh = useCallback(async () => {
    if (isOnline) {
      // Invalidate intelligent cache
      await intelligentCache.invalidateWithDependencies(category, cacheKey);
      return query.refetch();
    } else {
      // When offline, try to reload from cache
      const cachedData = await intelligentCache.getIntelligent<T>(category, cacheKey);
      if (cachedData) {
        queryClient.setQueryData(queryKey, cachedData);
        setIsFromCache(true);
        setCacheStatus('offline');
      }
    }
  }, [isOnline, query, category, cacheKey, queryClient, queryKey]);

  return {
    data: query.data,
    isLoading: !query.data && query.isLoading,
    isError: query.isError && cacheStatus !== 'stale' && cacheStatus !== 'offline',
    error: query.error,
    isFromCache,
    cacheStatus,
    isOnline,
    networkSpeed: intelligentCache.getNetworkSpeed(),
    storageStatus: intelligentCache.getStorageStatus(),
    refetch: refresh,
    isFetching: query.isFetching,
  };
};

// Helper function to determine if a realtime payload should trigger invalidation
async function shouldInvalidateForPayload(payload: any, queryKey: (string | null)[]): Promise<boolean> {
  // This is a simplified implementation - in practice, you'd analyze the payload
  // against the current query to see if it's relevant
  return true; // For now, always invalidate - can be optimized later
}

// Specialized hooks using the intelligent data system

export const useIntelligentFolders = () => {
  const { user } = useAuth();

  return useIntelligentData({
    queryKey: ['intelligent-folders', user?.id],
    category: 'folders',
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('folders')
        .select(`
          *,
          documents(id, is_private, user_id)
        `)
        .order('name');

      if (error) throw error;

      const filteredData = data?.filter(folder => 
        folder.user_id === userData.user?.id ||
        folder.documents?.some((doc: any) => !doc.is_private)
      ) || [];

      return filteredData;
    },
    enabled: !!user,
    realtimeTable: 'folders',
    preloadRelated: true,
    dependencies: ['documents']
  });
};

export const useIntelligentDocuments = (folderId?: string | null) => {
  const { user } = useAuth();

  return useIntelligentData({
    queryKey: ['intelligent-documents', user?.id, folderId],
    category: 'documents',
    queryFn: async () => {
      if (!folderId) return [];

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId)
        .order('name');

      if (error) throw error;

      const filteredData = data?.filter(doc => 
        doc.user_id === userData.user?.id || !doc.is_private
      ) || [];

      return filteredData;
    },
    enabled: !!user && !!folderId,
    realtimeTable: 'documents',
    realtimeFilter: folderId ? `folder_id=eq.${folderId}` : undefined,
    preloadRelated: true,
    dependencies: [`folders_${folderId}`]
  });
};

export const useIntelligentWorksheet = (documentId?: string) => {
  const { user } = useAuth();

  return useIntelligentData({
    queryKey: ['intelligent-worksheet', documentId],
    category: 'worksheets',
    queryFn: async () => {
      if (!documentId) return null;

      const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
        body: { documentId }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!documentId,
    dependencies: [`documents_${documentId}`]
  });
};