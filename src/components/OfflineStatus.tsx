import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { backgroundSync } from '@/utils/backgroundSync';

export const OfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(backgroundSync.getSyncStatus());
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
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
      
      // Show status if there are pending items
      if (newStatus.queueLength > 0) {
        setShowStatus(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!showStatus && isOnline && syncStatus.queueLength === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50 max-w-sm">
      <Alert className={`transition-all duration-300 ${
        !isOnline ? 'bg-destructive/10 border-destructive' : 'bg-primary/10 border-primary'
      }`}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-primary" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          
          <AlertDescription className="flex-1">
            {!isOnline && (
              <div>
                <span className="font-medium">Offline mode</span>
                <div className="text-sm text-muted-foreground mt-1">
                  Changes will sync when connected
                </div>
              </div>
            )}
            
            {isOnline && syncStatus.isSyncing && (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-sm">Syncing changes...</span>
              </div>
            )}
            
            {syncStatus.queueLength > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Clock className="h-3 w-3" />
                <Badge variant="secondary" className="text-xs">
                  {syncStatus.queueLength} pending
                </Badge>
              </div>
            )}
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
};