import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { cacheCoordinator } from '@/utils/cacheCoordinator';

interface CoverImageMetadata {
  url: string;
  timestamp: number;
  version?: string;
}

interface PreloadProgress {
  phase: 'initializing' | 'documents' | 'worksheets' | 'covers' | 'completed' | 'failed';
  current: number;
  total: number;
  currentItem?: string;
  percentage: number;
}

interface LevelPreloadResult {
  isPreloading: boolean;
  progress: PreloadProgress;
  startPreloading: (folderId: string, folderName: string) => Promise<void>;
  cancelPreloading: () => void;
  error?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  metadata?: any;
}

export const useLevelPreloader = (): LevelPreloadResult => {
  const { user } = useAuth();
  const [isPreloading, setIsPreloading] = useState(false);
  const [progress, setProgress] = useState<PreloadProgress>({
    phase: 'initializing',
    current: 0,
    total: 0,
    percentage: 0
  });
  const [error, setError] = useState<string>();
  const abortController = useRef<AbortController>();

  // Get network-aware batch sizes
  const getBatchSizes = () => {
    const networkSpeed = enhancedCache.getNetworkSpeed();
    switch (networkSpeed) {
      case 'fast': return { documents: 8, worksheets: 4, covers: 10 };
      case 'medium': return { documents: 5, worksheets: 3, covers: 6 };
      case 'slow': return { documents: 3, worksheets: 2, covers: 4 };
      default: return { documents: 5, worksheets: 3, covers: 6 };
    }
  };

  const updateProgress = (
    phase: PreloadProgress['phase'],
    current: number,
    total: number,
    currentItem?: string
  ) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    setProgress({ phase, current, total, percentage, currentItem });
  };

  const preloadDocumentMetadata = async (
    documents: DocumentItem[],
    signal: AbortSignal
  ): Promise<void> => {
    const batchSizes = getBatchSizes();
    updateProgress('documents', 0, documents.length);

    for (let i = 0; i < documents.length; i += batchSizes.documents) {
      if (signal.aborted) throw new Error('Preloading cancelled');

      const batch = documents.slice(i, i + batchSizes.documents);
      
      await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            updateProgress('documents', i + batch.indexOf(doc) + 1, documents.length, doc.name);
            
            // Cache document metadata
            await enhancedCache.setEnhanced('documents', doc.id, doc, {
              priority: 'high',
              dependencies: [`folders_${doc.id}`],
              version: '1.0'
            });
          } catch (error) {
            console.warn(`Failed to preload document metadata for ${doc.id}:`, error);
          }
        })
      );

      // Small delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };

  const preloadWorksheetData = async (
    documents: DocumentItem[],
    signal: AbortSignal
  ): Promise<void> => {
    const batchSizes = getBatchSizes();
    updateProgress('worksheets', 0, documents.length);

    for (let i = 0; i < documents.length; i += batchSizes.worksheets) {
      if (signal.aborted) throw new Error('Preloading cancelled');

      const batch = documents.slice(i, i + batchSizes.worksheets);
      
      await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            updateProgress('worksheets', i + batch.indexOf(doc) + 1, documents.length, doc.name);
            
            // Fetch and cache worksheet data with proper cache key coordination
            const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
              body: { worksheetId: doc.id },
            });

            if (!error && data) {
              // Cache with keys that match useWorksheetData hook
              await enhancedCache.setEnhanced('worksheets', doc.id, data, {
                priority: 'medium',
                dependencies: [`document_${doc.id}`],
                version: '1.0'
              });
              
              // Also cache with enhanced-worksheet key for useWorksheetData compatibility
              await enhancedCache.setEnhanced('enhanced-worksheet', doc.id, data, {
                priority: 'medium',
                dependencies: [`document_${doc.id}`],
                version: '1.0'
              });
              
              // Store worksheet version for cache coordinator
              await cacheCoordinator.storeVersion('worksheet', doc.id, '1.0');
            }
          } catch (error) {
            console.warn(`Failed to preload worksheet data for ${doc.id}:`, error);
          }
        })
      );

      // Longer delay for worksheet data to avoid overwhelming the edge function
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const preloadCoverImages = async (
    documents: DocumentItem[],
    signal: AbortSignal
  ): Promise<void> => {
    const batchSizes = getBatchSizes();
    updateProgress('covers', 0, documents.length);

    for (let i = 0; i < documents.length; i += batchSizes.covers) {
      if (signal.aborted) throw new Error('Preloading cancelled');

      const batch = documents.slice(i, i + batchSizes.covers);
      
      await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            updateProgress('covers', i + batch.indexOf(doc) + 1, documents.length, doc.name);
            
            // Use proper covers bucket and generate signed URLs
            let coverUrl = '';
            let coverVersion = '';
            
            const extensions = ['jpg', 'jpeg', 'png', 'webp'];
            for (const ext of extensions) {
              try {
                const filePath = `${doc.id}.${ext}`;
                
                // Get signed URL from covers bucket
                const { data: urlData, error: urlError } = await supabase.storage
                  .from('covers')
                  .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

                if (!urlError && urlData?.signedUrl) {
                  // Verify the file exists
                  const response = await fetch(urlData.signedUrl, { method: 'HEAD' });
                  if (response.ok) {
                    coverUrl = urlData.signedUrl;
                    
                    // Get file metadata for version tracking
                    const { data: fileList } = await supabase.storage
                      .from('covers')
                      .list('', { search: filePath, limit: 1 });
                    
                    if (fileList && fileList.length > 0) {
                      const file = fileList[0];
                      coverVersion = `${file.updated_at}_${file.metadata?.size || 0}`;
                    }
                    
                    break;
                  }
                }
              } catch (fetchError) {
                console.warn(`Failed to check cover ${doc.id}.${ext}:`, fetchError);
              }
            }

            if (coverUrl) {
              // Preload the image
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = coverUrl;
              });

              // Cache the cover with proper metadata structure matching useEnhancedCoverImage
              const coverMetadata: CoverImageMetadata = {
                url: coverUrl,
                timestamp: Date.now(),
                version: coverVersion
              };

              await enhancedCache.setEnhanced('covers', doc.id, coverMetadata, {
                priority: 'low',
                dependencies: [`documents_${doc.id}`],
                version: coverVersion || '1.0'
              });
              
              // Store version for cache coordinator
              if (coverVersion) {
                await cacheCoordinator.storeVersion('cover', doc.id, coverVersion);
              }
            }
          } catch (error) {
            console.warn(`Failed to preload cover for ${doc.id}:`, error);
          }
        })
      );

      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };

  const startPreloading = useCallback(async (folderId: string, folderName: string) => {
    if (isPreloading) return;

    try {
      setIsPreloading(true);
      setError(undefined);
      abortController.current = new AbortController();
      const signal = abortController.current.signal;

      updateProgress('initializing', 0, 0, 'Loading documents...');

      // Fetch all documents in the selected level
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, name, metadata')
        .eq('folder_id', folderId)
        .order('name');

      if (error) throw error;
      if (!documents?.length) {
        updateProgress('completed', 0, 0, 'No documents found');
        return;
      }

      // Track level selection for behavior analytics
      await enhancedCache.setEnhanced('user_behavior', `level_${folderId}`, {
        levelId: folderId,
        levelName: folderName,
        documentsCount: documents.length,
        lastSelected: Date.now(),
        preloadStarted: Date.now()
      }, {
        priority: 'medium',
        version: '1.0'
      });

      // Phase 1: Preload document metadata
      await preloadDocumentMetadata(documents, signal);
      
      // Phase 2: Preload worksheet JSON data
      await preloadWorksheetData(documents, signal);
      
      // Phase 3: Preload cover images
      await preloadCoverImages(documents, signal);

      updateProgress('completed', documents.length, documents.length, 'Preloading completed');
      
      // Mark level as fully cached
      await enhancedCache.setEnhanced('level_cache', folderId, {
        levelId: folderId,
        levelName: folderName,
        documentsPreloaded: documents.length,
        completedAt: Date.now(),
        version: '1.0'
      }, {
        priority: 'high',
        dependencies: [`folders_${folderId}`],
        version: '1.0'
      });

    } catch (error: any) {
      if (error?.message === 'Preloading cancelled') {
        updateProgress('initializing', 0, 0, 'Cancelled');
      } else {
        console.error('Preloading failed:', error);
        setError(error?.message || 'Preloading failed');
        updateProgress('failed', 0, 0, error?.message || 'Unknown error');
      }
    } finally {
      setIsPreloading(false);
    }
  }, [isPreloading]);

  const cancelPreloading = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    isPreloading,
    progress,
    startPreloading,
    cancelPreloading,
    error
  };
};