import { useState, useEffect } from 'react';
import { coverCache } from '@/utils/cacheManager';
import { extractCoverPath, findCoverImage, getCoverImageUrl } from '@/utils/coverUtils';

interface UseOfflineCoverImageResult {
  coverUrl: string | null;
  isLoading: boolean;
  error: string | null;
  isFromCache: boolean;
  isStale: boolean;
}

export const useOfflineCoverImage = (documentId: string, metadata?: any): UseOfflineCoverImageResult => {
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
        // 1. Try to load from cache first
        const cached = await coverCache.get(documentId);
        
        if (cached) {
          setCoverUrl(cached.data);
          setIsFromCache(true);
          
          // Check if cache is stale
          const stale = await coverCache.isStale(documentId);
          setIsStale(stale);
          
          // If cache is fresh and we're offline, stop here
          if (!stale || !navigator.onLine) {
            setIsLoading(false);
            return;
          }
        }

        // 2. Try to fetch fresh data if online
        if (navigator.onLine) {
          // First try to get cover path from metadata
          const coverPath = extractCoverPath(metadata);
          
          let result;
          if (coverPath) {
            // Extract extension from path and get signed URL
            const extension = coverPath.split('.').pop() || 'jpg';
            result = await getCoverImageUrl(documentId, extension);
          } else {
            // Try to find cover with common extensions
            result = await findCoverImage(documentId);
          }

          if (result.url) {
            // Fetch the image blob for caching
            try {
              const response = await fetch(result.url);
              if (response.ok) {
                const blob = await response.blob();
                await coverCache.set(documentId, result.url, blob);
                
                // Update URL if we didn't have cache or if it's different
                if (!cached || cached.data !== result.url) {
                  setCoverUrl(result.url);
                  setIsFromCache(false);
                }
                setIsStale(false);
              }
            } catch (fetchError) {
              console.warn('Failed to cache cover image:', fetchError);
              // Still use the URL even if caching failed
              setCoverUrl(result.url);
              setIsFromCache(false);
            }
          } else if (!cached) {
            // No cached data and no network data
            setCoverUrl(null);
            setError(result.error || 'No cover image found');
          }
        } else if (!cached) {
          // Offline and no cache
          setCoverUrl(null);
          setError('No cover image available offline');
        }
      } catch (err) {
        console.error('Error loading cover image:', err);
        
        // If we have cached data, use it despite the error
        if (coverUrl) {
          setError(null);
        } else {
          setError('Failed to load cover image');
          setCoverUrl(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCoverImage();

    // Listen for online/offline events to retry loading
    const handleOnline = () => {
      if (isStale || (!coverUrl && error)) {
        loadCoverImage();
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [documentId, metadata]);

  return { coverUrl, isLoading, error, isFromCache, isStale };
};

// Background preloader for covers
export const preloadCovers = async (documentIds: string[]) => {
  const preloadPromises = documentIds.map(async (documentId) => {
    try {
      // Check if already cached and fresh
      const cached = await coverCache.get(documentId);
      const stale = await coverCache.isStale(documentId);
      
      if (cached && !stale) {
        return; // Already have fresh cache
      }

      // Try to find and cache the cover
      const result = await findCoverImage(documentId);
      if (result.url) {
        const response = await fetch(result.url);
        if (response.ok) {
          const blob = await response.blob();
          await coverCache.set(documentId, result.url, blob);
        }
      }
    } catch (error) {
      console.warn(`Failed to preload cover for ${documentId}:`, error);
    }
  });

  // Process in batches to avoid overwhelming the network
  const batchSize = 5;
  for (let i = 0; i < preloadPromises.length; i += batchSize) {
    const batch = preloadPromises.slice(i, i + batchSize);
    await Promise.allSettled(batch);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};