import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { useAuth } from '@/contexts/AuthContext';

interface EnhancedOfflineDataOptions<T> {
  queryKey: (string | null)[];
  queryFn: () => Promise<T>;
  category: string;
  enabled?: boolean;
  staleTime?: number;
  dependencies?: string[];
  realtimeTable?: string;
  realtimeFilter?: string;
  preloadRelated?: boolean;
  onCacheHit?: (data: T) => void;
  onNetworkUpdate?: (data: T) => void;
}

export const useEnhancedOfflineData = <T>(options: EnhancedOfflineDataOptions<T>) => {
  const {
    queryKey,
    queryFn,
    category,
    enabled = true,
    staleTime = 30000,
    dependencies = [],
    realtimeTable,
    realtimeFilter,
    preloadRelated = false,
    onCacheHit,
    onNetworkUpdate
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'stale' | 'offline'>('fresh');

  const cacheKey = queryKey.filter(Boolean).join('_');

  // Load from enhanced cache immediately
  useEffect(() => {
    if (!enabled || !cacheKey) return;
    
    const loadFromCache = async () => {
      try {
        const cached = await enhancedCache.getEnhanced<T>(category, cacheKey);
        if (cached) {
          setCachedData(cached);
          setIsFromCache(true);
          setIsStale(false);
          setCacheStatus('fresh');
          onCacheHit?.(cached);
        }
      } catch (error) {
        console.error('Failed to load from enhanced cache:', error);
      }
    };
    
    loadFromCache();
  }, [cacheKey, enabled, category, onCacheHit]);

  // Network query with enhanced caching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const data = await queryFn();
        
        // Store in enhanced cache
        await enhancedCache.setEnhanced(category, cacheKey, data, {
          dependencies,
          version: '1.0'
        });
        
        // Trigger related preloading if enabled
        if (preloadRelated) {
          await enhancedCache.preloadRelated(category, cacheKey, { 
            userId: user?.id,
            currentData: data 
          });
        }
        
        setCachedData(data);
        setIsFromCache(false);
        setIsStale(false);
        setCacheStatus('fresh');
        
        onNetworkUpdate?.(data);
        return data;
      } catch (error) {
        // On network error, try to serve stale cache
        if (!isOnline) {
          const staleData = await enhancedCache.getEnhanced<T>(category, cacheKey);
          if (staleData) {
            setCacheStatus('offline');
            setIsStale(true);
            return staleData;
          }
        }
        throw error;
      }
    },
    enabled: enabled && isOnline,
    staleTime: enhancedCache.getNetworkSpeed() === 'fast' ? staleTime * 0.5 : staleTime,
    retry: (failureCount) => {
      // More aggressive retry when online, based on network speed
      const maxRetries = enhancedCache.getNetworkSpeed() === 'fast' ? 3 : 2;
      return isOnline && failureCount < maxRetries;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refetch if we have stale cached data
      if (isStale && enabled) {
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
  }, [isStale, enabled, query]);

  // Enhanced realtime updates with intelligent invalidation
  useEffect(() => {
    if (!realtimeTable || !enabled) return;

    const channel = supabase
      .channel(`${realtimeTable}-enhanced-${cacheKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: realtimeTable,
          filter: realtimeFilter
        },
        async (payload) => {
          try {
            // Intelligent cache invalidation based on change type
            if (payload.eventType === 'DELETE') {
              // More aggressive invalidation for deletes
              await enhancedCache.invalidateWithDependencies(category, cacheKey);
            } else {
              // For updates/inserts, we can be more selective
              const affectsCurrentData = await shouldInvalidateForPayload(payload, queryKey);
              if (affectsCurrentData) {
                await enhancedCache.invalidateWithDependencies(category, cacheKey);
              }
            }
            
            // Invalidate React Query cache
            queryClient.invalidateQueries({ queryKey });
            
            // Refetch if online
            if (isOnline) {
              query.refetch();
            }
          } catch (error) {
            console.error('Realtime invalidation failed:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, realtimeFilter, cacheKey, queryClient, queryKey, query, isOnline, enabled, category]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    try {
      if (isOnline) {
        // Invalidate enhanced cache and refetch
        await enhancedCache.invalidateWithDependencies(category, cacheKey);
        return query.refetch();
      } else {
        // When offline, try to reload from cache
        const cached = await enhancedCache.getEnhanced<T>(category, cacheKey);
        if (cached) {
          setCachedData(cached);
          setIsFromCache(true);
          setCacheStatus('offline');
          setIsStale(true);
        }
      }
    } catch (error) {
      console.error('Enhanced refresh failed:', error);
    }
  }, [isOnline, query, category, cacheKey]);

  return {
    data: query.data || cachedData,
    isLoading: !cachedData && query.isLoading,
    isError: query.isError && !cachedData,
    error: query.error,
    isFromCache: isFromCache && !query.data,
    isStale: isStale && !query.data,
    cacheStatus,
    isOnline,
    networkSpeed: enhancedCache.getNetworkSpeed(),
    storageStatus: enhancedCache.getStorageStatus(),
    refetch: refresh,
    isFetching: query.isFetching,
  };
};

// Helper function to determine if a realtime payload should trigger invalidation
async function shouldInvalidateForPayload(payload: any, queryKey: (string | null)[]): Promise<boolean> {
  // Smart invalidation logic - can be enhanced based on specific use cases
  if (payload.table === 'folders') {
    return queryKey.includes('folders') || queryKey.includes('documents');
  }
  if (payload.table === 'documents') {
    return queryKey.includes('documents') || queryKey.includes(payload.new?.folder_id);
  }
  return true; // Default to invalidate for safety
}

// Specialized hooks using the enhanced offline data system

export const useEnhancedFolders = () => {
  const { user } = useAuth();

  return useEnhancedOfflineData({
    queryKey: ['enhanced-folders', user?.id],
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
    dependencies: ['documents'],
    staleTime: 60000, // 1 minute
  });
};

export const useEnhancedDocuments = (folderId?: string | null) => {
  const { user } = useAuth();

  return useEnhancedOfflineData({
    queryKey: ['enhanced-documents', user?.id, folderId],
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
    dependencies: [`folders_${folderId}`],
    staleTime: 45000, // 45 seconds
  });
};

export const useEnhancedWorksheetData = (documentId?: string) => {
  const { user } = useAuth();

  return useEnhancedOfflineData({
    queryKey: ['enhanced-worksheet', documentId],
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
    dependencies: [`documents_${documentId}`],
    staleTime: 5 * 60 * 1000, // 5 minutes - longer for worksheet data
  });
};