import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { useUserActivatedLevels } from './useUserActivatedLevels';

interface PreloadProgress {
  folderId: string;
  folderName: string;
  total: number;
  completed: number;
  status: 'pending' | 'downloading' | 'complete' | 'error';
  currentItem?: string;
}

interface PreloadResult {
  success: boolean;
  error?: string;
  skipped?: number;
}

export const useLevelPreloader = () => {
  const [preloadProgress, setPreloadProgress] = useState<Record<string, PreloadProgress>>({});
  const [isPreloading, setIsPreloading] = useState(false);
  const queryClient = useQueryClient();
  const { data: activatedLevels = [] } = useUserActivatedLevels();

  const updateProgress = useCallback((folderId: string, update: Partial<PreloadProgress>) => {
    setPreloadProgress(prev => ({
      ...prev,
      [folderId]: { ...prev[folderId], ...update }
    }));
  }, []);

  const preloadLevel = useCallback(async (folderId: string, folderName: string): Promise<PreloadResult> => {
    try {
      // Initialize progress
      updateProgress(folderId, {
        folderId,
        folderName,
        total: 0,
        completed: 0,
        status: 'pending',
      });

      // Get all documents in this folder
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId);

      if (docsError) throw docsError;

      if (!documents?.length) {
        updateProgress(folderId, { status: 'complete', total: 0, completed: 0 });
        return { success: true, skipped: 0 };
      }

      const totalItems = documents.length * 2; // Documents + covers
      updateProgress(folderId, { 
        status: 'downloading', 
        total: totalItems,
        currentItem: 'Documents and covers'
      });

      let completed = 0;
      let skipped = 0;

      // Cache documents
      await documentStore.saveDocuments(documents, Date.now());
      completed += documents.length;
      updateProgress(folderId, { completed });

      // Preload covers for all documents in this level using blob caching
      for (const doc of documents) {
        try {
          updateProgress(folderId, { 
            completed, 
            currentItem: `Cover for ${doc.name || doc.id}` 
          });
          
          const { findAndCacheCover } = await import('@/utils/coverBlobCache');
          const coverResult = await findAndCacheCover(doc.id);
          
          if (coverResult.success) {
            console.log(`Cached cover blob for document ${doc.id}`);
          }
        } catch (error) {
          console.error(`Failed to cache cover for document ${doc.id}:`, error);
          skipped++;
        }
        
        completed++;
        updateProgress(folderId, { completed });
      }

      updateProgress(folderId, { status: 'complete' });

      // Invalidate related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['documents', folderId] });
      queryClient.invalidateQueries({ queryKey: ['covers'] });

      return { success: true, skipped };

    } catch (error) {
      console.error(`Failed to preload level ${folderId}:`, error);
      updateProgress(folderId, { 
        status: 'error',
        currentItem: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [updateProgress, queryClient]);

  // Enhanced preload all with intelligent verification
  const preloadAllActivatedLevels = useCallback(async () => {
    if (isPreloading || !activatedLevels.length) return;

    setIsPreloading(true);
    
    try {
      console.log('Starting smart preload verification...');
      
      const { data: folders } = await supabase
        .from('folders')
        .select('id, name')
        .in('id', activatedLevels);

      if (folders?.length) {
        // Smart verification - only preload what's actually needed
        const foldersToPreload = [];
        
        for (const folder of folders) {
          // Check if level already has cached content
          const cachedDocs = await documentStore.getDocuments(folder.id);
          const currentProgress = preloadProgress[folder.id];
          
          // Skip if already complete and has cached data
          if (currentProgress?.status === 'complete' && cachedDocs.length > 0) {
            console.log(`Skipping ${folder.name} - already preloaded`);
            continue;
          }
          
          foldersToPreload.push(folder);
        }
        
        if (foldersToPreload.length === 0) {
          console.log('All levels already preloaded, no action needed');
          return;
        }
        
        console.log(`Preloading ${foldersToPreload.length} levels:`, foldersToPreload.map(f => f.name));
        
        const results = await Promise.allSettled(
          foldersToPreload.map(folder => preloadLevel(folder.id, folder.name))
        );

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const errorCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

        console.log(`Preloading complete: ${successCount} successful, ${errorCount} errors`);
      }
    } catch (error) {
      console.error('Failed to preload activated levels:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [activatedLevels, isPreloading, preloadLevel, preloadProgress]);

  // Smart repreload when content changes
  const repreloadChangedLevels = useCallback(async (changedDocumentIds: string[]) => {
    if (!changedDocumentIds.length) return;

    try {
      // Get folders for changed documents
      const { data: documents } = await supabase
        .from('documents')
        .select('folder_id')
        .in('id', changedDocumentIds);

      if (documents?.length) {
        const uniqueFolderIds = [...new Set(documents.map(doc => doc.folder_id))];
        const activeFolders = uniqueFolderIds.filter(folderId => activatedLevels.includes(folderId));

        if (activeFolders.length > 0) {
          const { data: folders } = await supabase
            .from('folders')
            .select('id, name')
            .in('id', activeFolders);

          if (folders?.length) {
            console.log('Repreloading changed levels:', folders.map(f => f.name));
            await Promise.allSettled(
              folders.map(folder => preloadLevel(folder.id, folder.name))
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to repreload changed levels:', error);
    }
  }, [activatedLevels, preloadLevel]);

  // Get preload status for a specific level
  const getLevelPreloadStatus = useCallback((folderId: string) => {
    return preloadProgress[folderId] || null;
  }, [preloadProgress]);

  // Check if level needs preloading
  const needsPreloading = useQuery({
    queryKey: ['preload-status', activatedLevels],
    queryFn: async () => {
      if (!activatedLevels.length) return [];

      const needsPreload = [];
      for (const folderId of activatedLevels) {
        const cachedDocs = await documentStore.getDocuments(folderId);
        if (cachedDocs.length === 0) {
          needsPreload.push(folderId);
        }
      }
      return needsPreload;
    },
    enabled: activatedLevels.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - standardized cache duration
  });

  return {
    preloadLevel,
    preloadAllActivatedLevels,
    repreloadChangedLevels,
    getLevelPreloadStatus,
    preloadProgress,
    isPreloading,
    needsPreloading: needsPreloading.data || [],
    isCheckingPreloadStatus: needsPreloading.isLoading,
  };
};