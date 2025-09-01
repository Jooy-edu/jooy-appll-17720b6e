import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheManager, metadataCache } from '@/utils/cacheManager';

interface UseEnhancedOfflineCacheOptions<T> {
  queryKey: (string | null)[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  maxAge?: number;
  onCacheHit?: (data: T) => void;
  onNetworkUpdate?: (data: T) => void;
  realtimeTable?: string;
  realtimeFilter?: string;
}

export const useEnhancedOfflineCache = <T>(options: UseEnhancedOfflineCacheOptions<T>) => {
  const {
    queryKey,
    queryFn,
    enabled = true,
    staleTime = 30000, // 30 seconds
    maxAge = 5 * 60 * 1000, // 5 minutes
    onCacheHit,
    onNetworkUpdate,
    realtimeTable,
    realtimeFilter
  } = options;

  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const queryClient = useQueryClient();
  const cacheKey = queryKey.filter(Boolean).join('_');

  // Load from cache immediately
  useEffect(() => {
    if (!enabled || !cacheKey) return;
    
    const loadFromCache = async () => {
      try {
        const cached = await metadataCache.get(cacheKey);
        if (cached) {
          const age = Date.now() - cached.timestamp;
          const stale = age > maxAge;
          
          setCachedData(cached.data);
          setIsFromCache(true);
          setIsStale(stale);
          
          onCacheHit?.(cached.data);
        }
      } catch (error) {
        console.error('Failed to load from cache:', error);
      }
    };
    
    loadFromCache();
  }, [cacheKey, enabled, maxAge, onCacheHit]);

  // Network query with enhanced caching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      
      // Cache the fresh data
      await metadataCache.set(cacheKey, data);
      
      // Update component state
      setCachedData(data);
      setIsFromCache(false);
      setIsStale(false);
      
      onNetworkUpdate?.(data);
      return data;
    },
    enabled: enabled && isOnline,
    staleTime,
    retry: (failureCount) => {
      // More aggressive retry when online
      return isOnline && failureCount < 3;
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
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isStale, enabled, query]);

  // Realtime updates
  useEffect(() => {
    if (!realtimeTable || !enabled) return;

    const channel = supabase
      .channel(`${realtimeTable}-cache-${cacheKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: realtimeTable,
          filter: realtimeFilter
        },
        () => {
          // Invalidate cache and refetch
          metadataCache.set(cacheKey, null);
          queryClient.invalidateQueries({ queryKey });
          
          if (isOnline) {
            query.refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, realtimeFilter, cacheKey, queryClient, queryKey, query, isOnline, enabled]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (isOnline) {
      return query.refetch();
    } else {
      // When offline, just reload from cache
      const cached = await metadataCache.get(cacheKey);
      if (cached) {
        setCachedData(cached.data);
        setIsFromCache(true);
        setIsStale(Date.now() - cached.timestamp > maxAge);
      }
    }
  }, [isOnline, query, cacheKey, maxAge]);

  return {
    data: query.data || cachedData,
    isLoading: !cachedData && query.isLoading,
    isError: query.isError && !cachedData,
    error: query.error,
    isFromCache: isFromCache && !query.data,
    isStale: isStale && !query.data,
    isOnline,
    refetch: refresh,
    isFetching: query.isFetching,
  };
};