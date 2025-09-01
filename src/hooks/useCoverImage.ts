import { useState, useEffect } from 'react';
import { extractCoverPath, findCoverImage, getCoverImageUrl } from '@/utils/coverUtils';

interface UseCoverImageResult {
  coverUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

// Expose the enhanced cover cache globally for coordination
if (typeof window !== 'undefined') {
  (window as any).coverCache = new Map();
}

export const useCoverImage = (documentId: string, metadata?: any): UseCoverImageResult => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    // Check cache first
    const cachedUrl = (window as any).coverCache?.get(documentId);
    if (cachedUrl) {
      setCoverUrl(cachedUrl);
      return;
    }

    const loadCoverImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
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
          // Cache the URL
          if (typeof window !== 'undefined' && (window as any).coverCache) {
            (window as any).coverCache.set(documentId, result.url);
          }
          setCoverUrl(result.url);
        } else {
          setCoverUrl(null);
          setError(result.error || 'No cover image found');
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