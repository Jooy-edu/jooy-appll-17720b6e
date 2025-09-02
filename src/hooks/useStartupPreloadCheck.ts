import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserActivatedLevels } from './useUserActivatedLevels';
import { documentStore } from '@/utils/documentStore';

/**
 * Hook to verify cached content on app startup and determine what needs preloading
 */
export const useStartupPreloadCheck = () => {
  const { user } = useAuth();
  const { data: activatedLevels = [] } = useUserActivatedLevels();
  const [startupCheckComplete, setStartupCheckComplete] = useState(false);
  const [levelsNeedingPreload, setLevelsNeedingPreload] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !activatedLevels.length) {
      setStartupCheckComplete(true);
      return;
    }

    const performStartupCheck = async () => {
      try {
        const needsPreload: string[] = [];
        
        for (const folderId of activatedLevels) {
          // Check if we have cached documents and covers for this level
          const cachedDocs = await documentStore.getDocuments(folderId);
          
          if (cachedDocs.length === 0) {
            needsPreload.push(folderId);
          } else {
            // Also check if covers are properly cached
            let hasMissingCovers = false;
            for (const doc of cachedDocs.slice(0, 3)) { // Check first 3 docs
              const coverUrl = await documentStore.getCover(doc.id);
              if (!coverUrl) {
                hasMissingCovers = true;
                break;
              }
            }
            
            if (hasMissingCovers) {
              needsPreload.push(folderId);
            }
          }
        }
        
        setLevelsNeedingPreload(needsPreload);
        console.log(`Startup check: ${needsPreload.length}/${activatedLevels.length} levels need preloading`);
      } catch (error) {
        console.error('Startup preload check failed:', error);
        // Default to preloading all levels if check fails
        setLevelsNeedingPreload(activatedLevels);
      } finally {
        setStartupCheckComplete(true);
      }
    };

    performStartupCheck();
  }, [user, activatedLevels]);

  return {
    startupCheckComplete,
    levelsNeedingPreload,
    allContentCached: levelsNeedingPreload.length === 0
  };
};