import { useState, useEffect, useCallback } from 'react';
import { backgroundSync } from '@/utils/backgroundSync';
import { intelligentCache } from '@/utils/intelligentCacheManager';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  retries: number;
  conflictResolution?: 'client-wins' | 'server-wins' | 'manual';
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: number;
  conflictsCount: number;
  networkSpeed: 'slow' | 'medium' | 'fast';
  storageStatus: {
    used: number;
    quota: number;
    ratio: number;
  };
}

interface ConflictData {
  id: string;
  operation: SyncOperation;
  serverData: any;
  clientData: any;
  timestamp: number;
}

export const useSmartSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingOperations: 0,
    lastSyncTime: 0,
    conflictsCount: 0,
    networkSpeed: 'medium',
    storageStatus: { used: 0, quota: 0, ratio: 0 }
  });

  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>([]);

  // Update sync status periodically
  useEffect(() => {
    const updateStatus = () => {
      const bgSyncStatus = backgroundSync.getSyncStatus();
      setSyncStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        isSyncing: bgSyncStatus.isSyncing,
        pendingOperations: Array.isArray(bgSyncStatus.pendingItems) ? bgSyncStatus.pendingItems.length : (bgSyncStatus.pendingItems || 0),
        networkSpeed: intelligentCache.getNetworkSpeed(),
        storageStatus: intelligentCache.getStorageStatus()
      }));
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      // Trigger sync when back online
      processPendingOperations();
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Queue operation with priority
  const queueOperation = useCallback(async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries'>) => {
    const syncOp: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0
    };

    setSyncQueue(prev => {
      const newQueue = [...prev, syncOp];
      // Sort by priority and timestamp
      return newQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });
    });

    // If online, try to process immediately
    if (syncStatus.isOnline) {
      await processOperation(syncOp);
    }
  }, [syncStatus.isOnline]);

  // Process individual operation
  const processOperation = useCallback(async (operation: SyncOperation): Promise<boolean> => {
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));

      // Use existing background sync for the actual operation
      switch (operation.type) {
        case 'create':
          if (operation.table === 'document_regions') {
            await backgroundSync.queueDocumentRegionCreate(operation.data);
          } else if (operation.table === 'text_assignments') {
            await backgroundSync.queueTextAssignmentCreate(operation.data);
          }
          break;
        
        case 'update':
          if (operation.table === 'document_regions') {
            await backgroundSync.queueDocumentRegionUpdate(operation.data.id, operation.data);
          } else if (operation.table === 'text_assignments') {
            await backgroundSync.queueTextAssignmentUpdate(operation.data.id, operation.data);
          }
          break;
        
        case 'delete':
          if (operation.table === 'document_regions') {
            await backgroundSync.queueDocumentRegionDelete(operation.data.id);
          } else if (operation.table === 'text_assignments') {
            await backgroundSync.queueTextAssignmentDelete(operation.data.id);
          }
          break;
      }

      // Remove from queue on success
      setSyncQueue(prev => prev.filter(op => op.id !== operation.id));
      setSyncStatus(prev => ({ ...prev, lastSyncTime: Date.now() }));
      
      return true;
    } catch (error) {
      console.error('Sync operation failed:', error);
      
      // Handle conflicts
      if (isConflictError(error)) {
        const conflict: ConflictData = {
          id: operation.id,
          operation,
          serverData: (error as any).serverData,
          clientData: operation.data,
          timestamp: Date.now()
        };
        setConflicts(prev => [...prev, conflict]);
        setSyncStatus(prev => ({ ...prev, conflictsCount: prev.conflictsCount + 1 }));
      } else {
        // Retry logic
        operation.retries++;
        if (operation.retries < 3) {
          // Re-queue for retry
          setTimeout(() => processOperation(operation), Math.pow(2, operation.retries) * 1000);
        } else {
          // Max retries reached, remove from queue
          setSyncQueue(prev => prev.filter(op => op.id !== operation.id));
        }
      }
      
      return false;
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  // Process all pending operations
  const processPendingOperations = useCallback(async () => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) return;

    const operations = [...syncQueue];
    for (const operation of operations) {
      await processOperation(operation);
      
      // Add delay for slow networks to prevent overwhelming
      if (syncStatus.networkSpeed === 'slow') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [syncStatus.isOnline, syncStatus.isSyncing, syncStatus.networkSpeed, syncQueue, processOperation]);

  // Resolve conflict
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'client-wins' | 'server-wins' | 'merge',
    mergedData?: any
  ) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    let finalData;
    switch (resolution) {
      case 'client-wins':
        finalData = conflict.clientData;
        break;
      case 'server-wins':
        finalData = conflict.serverData;
        break;
      case 'merge':
        finalData = mergedData || conflict.clientData;
        break;
    }

    // Re-queue the operation with resolved data
    await queueOperation({
      type: conflict.operation.type,
      table: conflict.operation.table,
      data: finalData,
      priority: 'high' // Conflicts get high priority
    });

    // Remove from conflicts
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    setSyncStatus(prev => ({ ...prev, conflictsCount: prev.conflictsCount - 1 }));
  }, [conflicts, queueOperation]);

  // Force sync all pending operations
  const forcSync = useCallback(async () => {
    await processPendingOperations();
  }, [processPendingOperations]);

  // Clear all conflicts (for admin or debugging)
  const clearConflicts = useCallback(() => {
    setConflicts([]);
    setSyncStatus(prev => ({ ...prev, conflictsCount: 0 }));
  }, []);

  return {
    syncStatus,
    conflicts,
    queueOperation,
    resolveConflict,
    forcSync,
    clearConflicts,
    processPendingOperations
  };
};

// Helper function to detect conflict errors
function isConflictError(error: any): boolean {
  return error?.message?.includes('conflict') || 
         error?.status === 409 ||
         error?.code === 'PGRST116'; // Supabase conflict code
}