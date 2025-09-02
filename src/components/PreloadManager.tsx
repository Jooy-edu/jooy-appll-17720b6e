import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLevelPreloader } from '@/hooks/useLevelPreloader';
import { useUserActivatedLevels } from '@/hooks/useUserActivatedLevels';
import { useDebounce } from '@/hooks/useDebounce';
import { useStartupPreloadCheck } from '@/hooks/useStartupPreloadCheck';
import { usePreloadSession } from '@/hooks/usePreloadSession';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import { backgroundSyncService } from '@/utils/backgroundSyncService';
import { toast } from '@/components/ui/use-toast';

interface PreloadStatus {
  isPreloading: boolean;
  totalLevels: number;
  completedLevels: number;
  currentLevel?: string;
  errors: string[];
}

export const PreloadManager: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: activatedLevels = [], isLoading: levelsLoading } = useUserActivatedLevels();
  const { startupCheckComplete, levelsNeedingPreload, allContentCached } = useStartupPreloadCheck();
  const { 
    preloadAllActivatedLevels, 
    preloadProgress, 
    isPreloading 
  } = useLevelPreloader();
  const { 
    isLevelCompleted, 
    markLevelCompleted, 
    isSessionReady,
    completedCount 
  } = usePreloadSession();
  
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({
    isPreloading: false,
    totalLevels: 0,
    completedLevels: 0,
    errors: []
  });
  const [hasTriggeredPreload, setHasTriggeredPreload] = useState(false);
  const [showPreloadUI, setShowPreloadUI] = useState(false);
  
  // Debounced preload function to prevent rapid successive calls
  const [debouncedPreload] = useDebounce(preloadAllActivatedLevels, 2000);

  // Session-based preloading logic - prevents repetitive downloads
  useEffect(() => {
    if (authLoading || levelsLoading || !user || isPreloading || 
        !startupCheckComplete || !isSessionReady) return;
    
    // If all content is cached and session shows completion, no preload needed
    if (allContentCached && activatedLevels.length > 0) {
      console.log('All content already cached - no preloading needed');
      setHasTriggeredPreload(true);
      return;
    }
    
    // Filter levels that need preloading and aren't completed in current session
    const levelsToPreload = levelsNeedingPreload.filter(levelId => !isLevelCompleted(levelId));
    
    // Only trigger preloading if we haven't triggered it yet and there are levels to preload
    if (!hasTriggeredPreload && levelsToPreload.length > 0) {
      console.log(`Session-based preload: ${levelsToPreload.length} new levels need preloading`);
      setShowPreloadUI(true);
      setHasTriggeredPreload(true);
      debouncedPreload();
      return;
    }

    // Handle new activated levels - only preload levels not completed in session
    if (hasTriggeredPreload && activatedLevels.length > 0) {
      const newLevelsToPreload = activatedLevels.filter(levelId => 
        !isLevelCompleted(levelId) && 
        (levelsNeedingPreload.includes(levelId) || 
         (preloadProgress[levelId] && preloadProgress[levelId].status === 'error'))
      );
      
      if (newLevelsToPreload.length > 0) {
        console.log('Detected new levels needing preload (not in session):', newLevelsToPreload);
        setShowPreloadUI(true);
        debouncedPreload();
      }
    }
  }, [user, authLoading, levelsLoading, activatedLevels, hasTriggeredPreload, isPreloading, 
      debouncedPreload, startupCheckComplete, allContentCached, levelsNeedingPreload, 
      isSessionReady, isLevelCompleted]);

  // Update preload status and mark completed levels in session
  useEffect(() => {
    const levels = Object.values(preloadProgress);
    const totalLevels = levels.length;
    const completedLevels = levels.filter(level => level.status === 'complete').length;
    const errors = levels.filter(level => level.status === 'error').map(level => 
      `${level.folderName}: ${level.currentItem || 'Unknown error'}`
    );
    const currentLevel = levels.find(level => level.status === 'downloading')?.folderName;

    setPreloadStatus({
      isPreloading,
      totalLevels,
      completedLevels,
      currentLevel,
      errors
    });

    // Mark completed levels in session to prevent re-downloading
    levels.forEach(level => {
      if (level.status === 'complete' && !isLevelCompleted(level.folderId)) {
        markLevelCompleted(level.folderId);
      }
    });

    // Hide UI when preloading is complete
    if (!isPreloading && totalLevels > 0 && completedLevels === totalLevels) {
      setTimeout(() => {
        setShowPreloadUI(false);
        if (errors.length === 0) {
          toast({
            title: "Content Ready",
            description: `All ${totalLevels} levels preloaded successfully. Content is now available offline.`,
          });
        }
      }, 2000);
    }
  }, [preloadProgress, isPreloading, isLevelCompleted, markLevelCompleted]);

  // Show errors if any occur
  useEffect(() => {
    if (preloadStatus.errors.length > 0) {
      toast({
        title: "Preload Warnings",
        description: `Some content couldn't be preloaded: ${preloadStatus.errors[0]}`,
        variant: "destructive",
      });
    }
  }, [preloadStatus.errors]);

  // Don't render anything if no preloading is needed or in progress
  if (!showPreloadUI && !preloadStatus.isPreloading) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="border-primary/20 bg-card/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {preloadStatus.isPreloading ? (
              <Download className="h-5 w-5 text-primary animate-pulse" />
            ) : preloadStatus.errors.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle className="h-5 w-5 text-success" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {preloadStatus.isPreloading ? 'Preloading Content' : 'Content Ready'}
                </p>
                <span className="text-xs text-muted-foreground">
                  {preloadStatus.completedLevels}/{preloadStatus.totalLevels}
                </span>
              </div>
              
              {preloadStatus.totalLevels > 0 && (
                <Progress 
                  value={(preloadStatus.completedLevels / preloadStatus.totalLevels) * 100} 
                  className="h-2 mb-2" 
                />
              )}
              
              {preloadStatus.currentLevel && (
                <p className="text-xs text-muted-foreground truncate">
                  Loading: {preloadStatus.currentLevel}
                </p>
              )}
              
              {!preloadStatus.isPreloading && preloadStatus.errors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All content available offline
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};