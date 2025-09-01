import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSmartSync } from '@/hooks/useSmartSync';
import { 
  Wifi, 
  WifiOff, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Zap,
  HardDrive,
  Clock
} from 'lucide-react';

export const IntelligentOfflineStatus = () => {
  const { syncStatus, conflicts, forcSync, resolveConflict } = useSmartSync();
  const [showDetails, setShowDetails] = useState(false);
  const [autoHide, setAutoHide] = useState(true);

  // Auto-hide when everything is working well
  useEffect(() => {
    if (syncStatus.isOnline && 
        syncStatus.pendingOperations === 0 && 
        conflicts.length === 0 &&
        !syncStatus.isSyncing) {
      
      if (autoHide) {
        const timer = setTimeout(() => setShowDetails(false), 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowDetails(true);
    }
  }, [syncStatus, conflicts, autoHide]);

  // Don't show if everything is perfect and auto-hide is on
  if (!showDetails && 
      syncStatus.isOnline && 
      syncStatus.pendingOperations === 0 && 
      conflicts.length === 0 && 
      !syncStatus.isSyncing &&
      autoHide) {
    return null;
  }

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <WifiOff className="h-4 w-4" />;
    if (syncStatus.isSyncing) return <Upload className="h-4 w-4 animate-pulse" />;
    if (conflicts.length > 0) return <AlertTriangle className="h-4 w-4" />;
    if (syncStatus.pendingOperations > 0) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusMessage = () => {
    if (!syncStatus.isOnline) return 'Working offline - changes will sync when connected';
    if (syncStatus.isSyncing) return 'Syncing data...';
    if (conflicts.length > 0) return `${conflicts.length} sync conflicts need resolution`;
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} changes pending sync`;
    return 'All data synchronized';
  };

  const getStatusVariant = () => {
    if (!syncStatus.isOnline) return 'default';
    if (conflicts.length > 0) return 'destructive';
    if (syncStatus.pendingOperations > 0) return 'default';
    return 'default';
  };

  const getNetworkSpeedColor = () => {
    switch (syncStatus.networkSpeed) {
      case 'fast': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'slow': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-2">
      <Alert variant={getStatusVariant()} className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <AlertDescription className="flex-1">
              {getStatusMessage()}
            </AlertDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Network speed indicator */}
            <Badge 
              variant="outline" 
              className={`text-xs ${getNetworkSpeedColor()}`}
            >
              <Zap className="h-3 w-3 mr-1" />
              {syncStatus.networkSpeed}
            </Badge>

            {/* Storage indicator */}
            {syncStatus.storageStatus.ratio > 0.8 && (
              <Badge variant="outline" className="text-xs text-orange-600">
                <HardDrive className="h-3 w-3 mr-1" />
                {Math.round(syncStatus.storageStatus.ratio * 100)}%
              </Badge>
            )}

            {/* Actions */}
            <div className="flex space-x-1">
              {syncStatus.pendingOperations > 0 && syncStatus.isOnline && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={forcSync}
                  className="text-xs px-2 py-1"
                  disabled={syncStatus.isSyncing}
                >
                  Sync Now
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs px-2 py-1"
              >
                {showDetails ? 'Hide' : 'Details'}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAutoHide(!autoHide)}
                className="text-xs px-1 py-1"
              >
                {autoHide ? '📌' : '🔓'}
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed status */}
        {showDetails && (
          <div className="mt-3 space-y-2">
            {/* Sync progress */}
            {syncStatus.isSyncing && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Synchronizing...</span>
                  <span>{syncStatus.pendingOperations} remaining</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
            )}

            {/* Storage status */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center">
                <HardDrive className="h-3 w-3 mr-1" />
                Cache Storage: {Math.round(syncStatus.storageStatus.used / 1024 / 1024)}MB / {Math.round(syncStatus.storageStatus.quota / 1024 / 1024)}MB
              </span>
              <Progress 
                value={syncStatus.storageStatus.ratio * 100} 
                className="h-1 w-20"
              />
            </div>

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-red-600">
                  Sync Conflicts ({conflicts.length})
                </div>
                {conflicts.slice(0, 3).map((conflict) => (
                  <div key={conflict.id} className="flex items-center justify-between text-xs bg-red-50 p-2 rounded">
                    <span>
                      {conflict.operation.table} - {conflict.operation.type}
                    </span>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveConflict(conflict.id, 'client-wins')}
                        className="text-xs px-2 py-1"
                      >
                        Keep Local
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveConflict(conflict.id, 'server-wins')}
                        className="text-xs px-2 py-1"
                      >
                        Use Server
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Last sync time */}
            {syncStatus.lastSyncTime > 0 && (
              <div className="text-xs text-gray-500">
                Last synced: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </Alert>
    </div>
  );
};