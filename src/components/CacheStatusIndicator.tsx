import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { backgroundSync } from '@/utils/backgroundSync';
import { cacheCoordinator } from '@/utils/cacheCoordinator';
import { useToast } from '@/hooks/use-toast';

interface CacheStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({
  className = '',
  showDetails = false
}) => {
  const [syncStatus, setSyncStatus] = React.useState(backgroundSync.getSyncStatus());
  const [validationStatus, setValidationStatus] = React.useState(cacheCoordinator.getValidationStatus());
  const { toast } = useToast();

  React.useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(backgroundSync.getSyncStatus());
      setValidationStatus(cacheCoordinator.getValidationStatus());
    };

    // Update status every 2 seconds
    const interval = setInterval(updateStatus, 2000);
    
    // Update immediately
    updateStatus();

    // Listen for online/offline events
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualValidation = async () => {
    if (!syncStatus.isOnline) {
      toast({
        title: "Cannot validate cache",
        description: "You need to be online to validate cached data",
        variant: "destructive"
      });
      return;
    }

    try {
      await backgroundSync.validateCache();
      toast({
        title: "Cache validated",
        description: "All cached data has been checked against the server",
      });
    } catch (error) {
      toast({
        title: "Validation failed",
        description: error instanceof Error ? error.message : "Failed to validate cache",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }
    
    if (syncStatus.isSyncing || validationStatus.isValidating) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    
    if (syncStatus.queueLength > 0) {
      return <Clock className="h-4 w-4" />;
    }
    
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (!syncStatus.isOnline) return "destructive";
    if (syncStatus.isSyncing || validationStatus.isValidating) return "secondary";
    if (syncStatus.queueLength > 0) return "outline";
    return "default";
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return "Offline";
    if (validationStatus.isValidating) return "Validating";
    if (syncStatus.isSyncing) return "Syncing";
    if (syncStatus.queueLength > 0) return `${syncStatus.queueLength} pending`;
    return "Synced";
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={getStatusVariant()} className="flex items-center gap-1">
        {getStatusIcon()}
        <span className="text-xs">{getStatusText()}</span>
      </Badge>

      {showDetails && (
        <div className="flex items-center gap-1">
          {syncStatus.isOnline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualValidation}
              disabled={validationStatus.isValidating}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${validationStatus.isValidating ? 'animate-spin' : ''}`} />
              Validate
            </Button>
          )}

          <Badge variant="outline" className="text-xs">
            {validationStatus.networkSpeed}
          </Badge>
        </div>
      )}
    </div>
  );
};