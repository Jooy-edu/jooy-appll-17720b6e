import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, RefreshCw, Clock, Download, CheckCircle } from 'lucide-react';
import { backgroundSync } from '@/utils/backgroundSync';
import { useEnhancedCoverPreloading } from '@/hooks/useEnhancedCoverPreloading';

export const OfflineStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(backgroundSync.getSyncStatus());
  const [showStatus, setShowStatus] = useState(false);
  const { status: preloadStatus } = useEnhancedCoverPreloading();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 5000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update sync status periodically
    const interval = setInterval(() => {
      const newStatus = backgroundSync.getSyncStatus();
      setSyncStatus(newStatus);
      
      // Show status if there are pending items or preloading is active
      if (newStatus.queueLength > 0 || preloadStatus.isPreloading) {
        setShowStatus(true);
      } else if (showStatus && newStatus.queueLength === 0 && !preloadStatus.isPreloading) {
        // Auto-hide after sync completes
        setTimeout(() => setShowStatus(false), 3000);
      }
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [preloadStatus.isPreloading, showStatus]);

  // Always show if offline or if there's activity
  const shouldShow = !isOnline || 
                   syncStatus.queueLength > 0 || 
                   syncStatus.isSyncing || 
                   preloadStatus.isPreloading ||
                   showStatus;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Alert className={`transition-all duration-300 ${
        !isOnline ? 'bg-destructive/10 border-destructive' : 'bg-primary/10 border-primary'
      }`}>
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {!isOnline ? (
              <WifiOff className="h-4 w-4 text-destructive" />
            ) : syncStatus.isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            ) : preloadStatus.isPreloading ? (
              <Download className="h-4 w-4 text-primary" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>
          
          {/* Status Content */}
          <div className="flex-1 min-w-0">
            <AlertDescription>
              {!isOnline && (
                <div className="mb-2">
                  <div className="font-medium text-destructive">Offline Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Changes will sync when connected
                  </div>
                </div>
              )}
              
              {/* Sync Status */}
              {syncStatus.isSyncing && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Syncing changes...</span>
                </div>
              )}
              
              {/* Pending Queue */}
              {syncStatus.queueLength > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3 w-3" />
                  <Badge variant="secondary" className="text-xs">
                    {syncStatus.queueLength} pending
                  </Badge>
                </div>
              )}
              
              {/* Preloading Status */}
              {preloadStatus.isPreloading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Preloading covers...</span>
                    <span className="text-muted-foreground">
                      {preloadStatus.preloaded}/{preloadStatus.totalToPreload}
                    </span>
                  </div>
                  <Progress 
                    value={preloadStatus.progress} 
                    className="h-2"
                  />
                </div>
              )}
              
              {/* Success State */}
              {isOnline && !syncStatus.isSyncing && syncStatus.queueLength === 0 && !preloadStatus.isPreloading && showStatus && (
                <div className="text-sm text-green-600 font-medium">
                  All changes synced
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
};