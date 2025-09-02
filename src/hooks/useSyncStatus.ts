import { useState, useEffect } from 'react';
import { backgroundSyncService } from '@/utils/backgroundSyncService';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAttempt: number | null;
  manualSync: () => Promise<{ success: boolean; message: string }>;
}

export const useSyncStatus = (): SyncStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check sync status periodically
    const syncCheckInterval = setInterval(() => {
      setIsSyncing(backgroundSyncService.isSyncing());
      setIsOnline(!backgroundSyncService.isOffline());
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncCheckInterval);
    };
  }, []);

  const manualSync = async () => {
    const result = await backgroundSyncService.manualSync();
    setLastSyncAttempt(Date.now());
    return result;
  };

  return {
    isOnline,
    isSyncing,
    lastSyncAttempt,
    manualSync,
  };
};