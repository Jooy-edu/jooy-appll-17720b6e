import { useState, useEffect } from 'react';
import { getCachedCover } from '@/utils/coverBlobCache';

interface UseCoverImageResult {
  coverUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

// In-memory cache for cover URLs to avoid redundant blob operations
const coverCache = new Map<string, string>();

export const useCoverImage = (documentId: string, metadata?: any): UseCoverImageResult => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    // Check in-memory cache first for immediate return
    const cachedUrl = coverCache.get(documentId);
    if (cachedUrl) {
      setCoverUrl(cachedUrl);
      return;
    }

    const loadCoverImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use blob-based caching for permanent offline access
        const blobUrl = await getCachedCover(documentId);
        
        if (blobUrl) {
          // Cache in memory for quick subsequent access
          coverCache.set(documentId, blobUrl);
          setCoverUrl(blobUrl);
        } else {
          setCoverUrl(null);
          setError('No cover image found');
        }
      } catch (err) {
        console.error('Error loading cover image:', err);
        setError('Failed to load cover image');
        setCoverUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadCoverImage();
  }, [documentId, metadata]);

  return { coverUrl, isLoading, error };
};