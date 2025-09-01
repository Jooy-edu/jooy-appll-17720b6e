import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { cacheCoordinator } from '@/utils/cacheCoordinator';

interface CoverImageResult {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  isFromCache: boolean;
  isStale: boolean;
}

interface CoverImageMetadata {
  url: string;
  timestamp: number;
  etag?: string;
  version?: string;
}

export const useEnhancedCoverImage = (documentId: string, metadata?: any): CoverImageResult => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const loadCoverImage = async () => {
      setIsLoading(true);
      setError(null);
      setIsFromCache(false);
      setIsStale(false);

      try {
        // First try to get from enhanced cache
        const cached = await enhancedCache.getEnhanced<CoverImageMetadata>('covers', documentId);
        
        if (cached) {
          setCoverUrl(cached.url);
          setIsFromCache(true);
          
          // Check if cached cover is stale (older than 1 hour)
          const isStaleCache = Date.now() - cached.timestamp > 60 * 60 * 1000;
          setIsStale(isStaleCache);
          
          // If online and stale, validate against server
          if (navigator.onLine && isStaleCache) {
            const validation = await cacheCoordinator.validateCacheItem('cover', documentId);
            
            if (validation.hasServerChanges) {
              // Server has changes, reload from server
              await loadFromServer();
            } else if (validation.newVersion) {
              // Update cache version but keep the URL
              await cacheCoordinator.storeVersion('cover', documentId, validation.newVersion);
              setIsStale(false);
            }
          }
          
          // If we have cached data and we're offline, or cache is fresh, return early
          if (!navigator.onLine || !isStaleCache) {
            setIsLoading(false);
            return;
          }
        }

        // If no cache or need to load from server
        if (!cached || (navigator.onLine && cached)) {
          await loadFromServer();
        }

      } catch (err) {
        console.error('Error loading cover image:', err);
        setError('Failed to load cover image');
        setCoverUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    const loadFromServer = async () => {
      try {
        // Extract cover path from metadata if available
        const coverPath = metadata?.cover_image_path;
        let result;

        if (coverPath) {
          const extension = coverPath.split('.').pop() || 'jpg';
          result = await getCoverImageUrl(documentId, extension);
        } else {
          result = await findCoverImage(documentId);
        }

        if (result.url) {
          // Cache the result with metadata
          const cacheData: CoverImageMetadata = {
            url: result.url,
            timestamp: Date.now(),
            version: result.version
          };

          await enhancedCache.setEnhanced('covers', documentId, cacheData, {
            priority: 'medium',
            dependencies: [`document_${documentId}`]
          });

          // Store version for future validation
          if (result.version) {
            await cacheCoordinator.storeVersion('cover', documentId, result.version);
          }

          setCoverUrl(result.url);
          setIsFromCache(false);
          setIsStale(false);
        } else {
          setCoverUrl(null);
          setError(result.error || 'No cover image found');
        }

      } catch (err) {
        console.error('Error loading from server:', err);
        throw err;
      }
    };

    loadCoverImage();

    // Subscribe to cache invalidation events
    const handleCacheInvalidation = (event: CustomEvent) => {
      const { type, id } = event.detail;
      if (type === 'cover' && id === documentId) {
        // Reload cover image when cache is invalidated
        loadCoverImage();
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation as EventListener);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation as EventListener);
    };

  }, [documentId, metadata]);

  return { 
    url: coverUrl, 
    isLoading, 
    error, 
    isFromCache, 
    isStale 
  };
};

// Enhanced cover utility functions with version tracking
async function getCoverImageUrl(documentId: string, extension: string = 'jpg'): Promise<{url: string | null; error?: string; version?: string}> {
  try {
    const filePath = `${documentId}.${extension}`;
    
    // Get signed URL
    const { data, error } = await supabase.storage
      .from('covers')
      .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

    if (error) {
      return { url: null, error: error.message };
    }

    // Get file metadata for version tracking
    const { data: fileList } = await supabase.storage
      .from('covers')
      .list('', { search: filePath, limit: 1 });

    let version;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      version = `${file.updated_at}_${file.metadata?.size || 0}`;
    }

    return { 
      url: data?.signedUrl || null, 
      version 
    };

  } catch (error) {
    console.error('Error in getCoverImageUrl:', error);
    return { url: null, error: 'Failed to get cover image' };
  }
}

async function findCoverImage(documentId: string): Promise<{url: string | null; error?: string; version?: string}> {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  
  for (const ext of extensions) {
    const result = await getCoverImageUrl(documentId, ext);
    if (result.url) {
      return result;
    }
  }
  
  return { url: null, error: 'No cover image found' };
}
