import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { toast } from 'sonner';

export const SyncStatusIndicator: React.FC = () => {
  const { isOnline, isSyncing, manualSync } = useSyncStatus();

  const handleManualSync = async () => {
    const result = await manualSync();
    if (result.success) {
      toast.success('Sync complete', { description: result.message });
    } else {
      toast.error('Sync failed', { description: result.message });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isOnline ? "default" : "destructive"} 
        className="flex items-center gap-1"
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>
      
      {isSyncing && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing
        </Badge>
      )}
      
      {isOnline && !isSyncing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualSync}
          className="h-6 px-2 text-xs"
        >
          <Cloud className="h-3 w-3 mr-1" />
          Sync Now
        </Button>
      )}
    </div>
  );
};