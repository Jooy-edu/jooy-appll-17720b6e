import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { coverCache } from '@/utils/cacheManager';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { useEnhancedOfflineCache } from './useEnhancedOfflineCache';
import { useNetworkAwareLoading } from './useNetworkAwareLoading';
import { supabase } from '@/integrations/supabase/client';

interface CoverPreloadingStatus {
  isPreloading: boolean;
  totalToPreload: number;
  preloaded: number;
  failed: number;
  progress: number;
}

const MAX_CONCURRENT_PRELOADS = 3;
const PRELOAD_QUEUE_SIZE = 50;

export const useEnhancedCoverPreloading = () => {
  const { user } = useAuth();
  const { isSlowNetwork, loadingStrategy, batchLoad } = useNetworkAwareLoading();
  
  // Adjust concurrent preloads based on network speed
  const maxConcurrent = isSlowNetwork ? 1 : MAX_CONCURRENT_PRELOADS;
  const queueSize = isSlowNetwork ? 20 : PRELOAD_QUEUE_SIZE;
  const [status, setStatus] = useState<CoverPreloadingStatus>({
    isPreloading: false,
    totalToPreload: 0,
    preloaded: 0,
    failed: 0,
    progress: 0
  });
  
  const preloadQueue = useRef<string[]>([]);
  const activePreloads = useRef<Set<string>>(new Set());
  const preloadedIds = useRef<Set<string>>(new Set());

  // Get all accessible documents for aggressive preloading
  const { data: allDocuments } = useEnhancedOfflineCache({
    queryKey: ['all-accessible-documents', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: folders } = await supabase
        .from('folders')
        .select(`
          id,
          documents(id, folder_id, user_id, is_private, metadata)
        `);
      
      if (!folders) return [];
      
      // Flatten and filter documents user can access
      const allDocs = folders
        .flatMap(folder => folder.documents || [])
        .filter((doc: any) => doc.user_id === user.id || !doc.is_private);
      
      return allDocs;
    },
    enabled: !!user,
    maxAge: 10 * 60 * 1000, // 10 minutes
    realtimeTable: 'documents',
  });

  // Preload cover for a single document with enhanced caching
  const preloadCover = async (documentId: string): Promise<boolean> => {
    if (preloadedIds.current.has(documentId)) {
      return true;
    }

    try {
      // Check enhanced cache first
      const enhancedCached = await enhancedCache.getEnhanced<{ url: string }>('covers', documentId);
      if (enhancedCached?.url) {
        preloadedIds.current.add(documentId);
        return true;
      }

      // Check basic cache
      const cached = await coverCache.get(documentId);
      if (cached && !await coverCache.isStale(documentId)) {
        preloadedIds.current.add(documentId);
        return true;
      }

      // Find cover URL
      let coverUrl: string | null = null;
      
      // Try metadata first
      const document = allDocuments?.find(doc => doc.id === documentId);
      const metadata = document?.metadata as any;
      if (metadata && typeof metadata === 'object' && metadata.coverImage) {
        coverUrl = metadata.coverImage;
      } else {
        // Try common cover extensions
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        for (const ext of extensions) {
          const testUrl = `/pdfs/${documentId}/cover.${ext}`;
          try {
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (response.ok) {
              coverUrl = testUrl;
              break;
            }
          } catch (error) {
            // Continue to next extension
          }
        }
      }

      if (coverUrl) {
        // Fetch and cache the image
        const response = await fetch(coverUrl);
        if (response.ok) {
          const blob = await response.blob();
          
          // Store in both caches
          await coverCache.set(documentId, coverUrl, blob);
          await enhancedCache.setEnhanced(
            'covers',
            documentId,
            { url: coverUrl, timestamp: Date.now(), size: blob.size },
            {
              priority: 'low',
              dependencies: [`documents_${documentId}`]
            }
          );
          
          preloadedIds.current.add(documentId);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn(`Failed to preload cover for document ${documentId}:`, error);
      return false;
    }
  };

  // Process preload queue with network-aware concurrency control
  const processPreloadQueue = async () => {
    while (preloadQueue.current.length > 0 && activePreloads.current.size < maxConcurrent) {
      const documentId = preloadQueue.current.shift();
      if (!documentId || activePreloads.current.has(documentId)) continue;
      
      activePreloads.current.add(documentId);
      
      preloadCover(documentId)
        .then((success) => {
          setStatus(prev => ({
            ...prev,
            preloaded: prev.preloaded + (success ? 1 : 0),
            failed: prev.failed + (success ? 0 : 1),
            progress: ((prev.preloaded + prev.failed + 1) / prev.totalToPreload) * 100
          }));
        })
        .finally(() => {
          activePreloads.current.delete(documentId);
          // Continue processing queue
          processPreloadQueue();
        });
    }
    
    // Check if preloading is complete
    if (preloadQueue.current.length === 0 && activePreloads.current.size === 0) {
      setStatus(prev => ({ ...prev, isPreloading: false }));
    }
  };

  // Start aggressive preloading when documents are available
  useEffect(() => {
    if (!allDocuments?.length) return;
    
    // Filter documents that need preloading
    const documentsToPreload = allDocuments
      .map((doc: any) => doc.id)
      .filter(id => !preloadedIds.current.has(id))
      .slice(0, queueSize); // Use network-aware queue size
    
    if (documentsToPreload.length === 0) return;
    
    // Setup preload queue
    preloadQueue.current = [...documentsToPreload];
    setStatus({
      isPreloading: true,
      totalToPreload: documentsToPreload.length,
      preloaded: 0,
      failed: 0,
      progress: 0
    });
    
    // Start processing
    processPreloadQueue();
  }, [allDocuments]);

  // Preload specific document covers (high priority)
  const preloadSpecificCovers = async (documentIds: string[]) => {
    const needsPreloading = documentIds.filter(id => !preloadedIds.current.has(id));
    
    if (needsPreloading.length === 0) return;
    
    // Add to front of queue (high priority)
    preloadQueue.current.unshift(...needsPreloading);
    
    if (!status.isPreloading) {
      setStatus(prev => ({
        ...prev,
        isPreloading: true,
        totalToPreload: prev.totalToPreload + needsPreloading.length
      }));
      processPreloadQueue();
    }
  };

  return {
    status,
    preloadSpecificCovers,
    isPreloadingActive: status.isPreloading,
    preloadProgress: status.progress
  };
};