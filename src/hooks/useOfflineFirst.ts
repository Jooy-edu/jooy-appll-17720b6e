import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheManager, metadataCache, folderCache } from '@/utils/cacheManager';
import { supabase } from '@/integrations/supabase/client';

interface UseOfflineFirstOptions {
  cacheKey: string;
  fetchFn: () => Promise<any>;
  maxAge?: number;
  enabled?: boolean;
  onCacheHit?: (data: any) => void;
  onNetworkUpdate?: (data: any) => void;
}

export const useOfflineFirst = <T>({
  cacheKey,
  fetchFn,
  maxAge = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  onCacheHit,
  onNetworkUpdate
}: UseOfflineFirstOptions) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheData, setCacheData] = useState<T | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
  const queryClient = useQueryClient();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load from cache first
  useEffect(() => {
    if (!enabled) return;
    
    const loadFromCache = async () => {
      try {
        const cached = await metadataCache.get(cacheKey);
        if (cached) {
          setCacheData(cached.data);
          onCacheHit?.(cached.data);
        }
      } catch (error) {
        console.error('Error loading from cache:', error);
      } finally {
        setIsLoadingFromCache(false);
      }
    };

    loadFromCache();
  }, [cacheKey, enabled, onCacheHit]);

  // Network query with stale-while-revalidate pattern
  const query = useQuery({
    queryKey: [cacheKey],
    queryFn: fetchFn,
    enabled: enabled && isOnline,
    staleTime: maxAge,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Update cache when network data changes
  useEffect(() => {
    if (query.data && !query.isError) {
      metadataCache.set(cacheKey, query.data);
      setCacheData(query.data);
      onNetworkUpdate?.(query.data);
    }
  }, [query.data, query.isError, cacheKey, onNetworkUpdate]);

  // Determine which data to return
  const data = query.data || cacheData;
  const isLoading = isLoadingFromCache || (query.isLoading && !cacheData);
  const isStale = !query.data && !!cacheData;

  const refetch = useCallback(() => {
    if (isOnline) {
      query.refetch();
    }
  }, [isOnline, query]);

  return {
    data,
    isLoading,
    isStale,
    isOnline,
    isError: query.isError && !cacheData,
    error: query.error,
    refetch,
    isCachedData: !!cacheData && !query.data
  };
};

// Specialized hook for documents
export const useOfflineDocuments = (folderId?: string) => {
  return useOfflineFirst({
    cacheKey: `documents-${folderId}`,
    fetchFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId!)
        .order('name');
      
      if (error) throw error;
      
      // Filter to show user's own documents OR public documents
      const filteredData = data?.filter(doc => 
        doc.user_id === user.user?.id || !doc.is_private
      ) || [];
      
      return filteredData;
    },
    enabled: !!folderId,
  });
};

// Specialized hook for folders
export const useOfflineFolders = () => {
  return useOfflineFirst({
    cacheKey: 'folders',
    fetchFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
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
        folder.user_id === user.user?.id ||
        folder.documents?.some((doc: any) => !doc.is_private)
      ) || [];
      
      return filteredData;
    },
  });
};

// Hook for worksheet data with offline support
export const useOfflineWorksheetData = (documentId?: string) => {
  return useOfflineFirst({
    cacheKey: `worksheet-${documentId}`,
    fetchFn: async () => {
      if (!documentId) throw new Error('Document ID is required');
      
      const response = await supabase.functions.invoke('get-worksheet-data', {
        body: { documentId }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: !!documentId,
    maxAge: 10 * 60 * 1000, // 10 minutes for worksheet data
  });
};