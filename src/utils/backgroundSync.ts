import { cacheManager } from './cacheManager';
import { supabase } from '@/integrations/supabase/client';
import { cacheCoordinator } from './cacheCoordinator';

interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

export class BackgroundSync {
  private syncQueue: SyncQueueItem[] = [];
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private maxRetries = 3;

  constructor() {
    this.init();
  }

  private async init() {
    // Load pending sync items from cache
    await this.loadSyncQueue();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
      // Validate cached items against server when network returns
      this.validateCacheOnNetworkReturn();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Register service worker background sync if available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Listen for sync events from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'BACKGROUND_SYNC') {
            this.processSyncQueue();
          }
        });
      });
    }

    // Process queue on startup if online
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  async queueOperation(operation: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) {
    const item: SyncQueueItem = {
      ...operation,
      id: `${operation.table}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retries: 0
    };

    this.syncQueue.push(item);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    } else {
      // Register for background sync if offline
      this.registerBackgroundSync();
    }
  }

  private async loadSyncQueue() {
    try {
      await cacheManager.init();
      const cached = await cacheManager.get('cache_meta', 'sync_queue');
      if (cached && Array.isArray(cached.data)) {
        this.syncQueue = cached.data;
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue() {
    try {
      await cacheManager.set('cache_meta', 'sync_queue', this.syncQueue);
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private async processSyncQueue() {
    if (!this.isOnline || this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    const itemsToProcess = [...this.syncQueue];
    const successfulIds: string[] = [];

    for (const item of itemsToProcess) {
      try {
        await this.syncItem(item);
        successfulIds.push(item.id);
      } catch (error) {
        console.error(`Sync failed for item ${item.id}:`, error);
        
        // Increment retry count
        item.retries++;
        
        // Remove item if max retries reached
        if (item.retries >= this.maxRetries) {
          successfulIds.push(item.id); // Remove from queue
          console.error(`Max retries reached for sync item ${item.id}, removing from queue`);
        }
      }
    }

    // Remove successful items from queue
    this.syncQueue = this.syncQueue.filter(item => !successfulIds.includes(item.id));
    await this.saveSyncQueue();

    this.isSyncing = false;

    // If there are still items and we failed some, register for background sync
    if (this.syncQueue.length > 0) {
      this.registerBackgroundSync();
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { type, table, data } = item;

    switch (type) {
      case 'create':
        const { error: createError } = await (supabase as any)
          .from(table)
          .insert(data);
        if (createError) throw createError;
        break;

      case 'update':
        const { error: updateError } = await (supabase as any)
          .from(table)
          .update(data.updates)
          .match(data.match);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await (supabase as any)
          .from(table)
          .delete()
          .match(data.match);
        if (deleteError) throw deleteError;
        break;

      default:
        throw new Error(`Unknown sync operation type: ${type}`);
    }
  }

  private registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in (window as any).ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration: any) => {
        return registration.sync.register('background-sync');
      }).catch((error) => {
        console.error('Background sync registration failed:', error);
      });
    }
  }

  // Public methods for queuing different operations
  async queueDocumentRegionCreate(data: any) {
    return this.queueOperation({
      type: 'create',
      table: 'document_regions',
      data
    });
  }

  async queueDocumentRegionUpdate(id: string, updates: any) {
    return this.queueOperation({
      type: 'update',
      table: 'document_regions',
      data: { match: { id }, updates }
    });
  }

  async queueDocumentRegionDelete(id: string) {
    return this.queueOperation({
      type: 'delete',
      table: 'document_regions',
      data: { match: { id } }
    });
  }

  async queueTextAssignmentCreate(data: any) {
    return this.queueOperation({
      type: 'create',
      table: 'text_assignments',
      data
    });
  }

  async queueTextAssignmentUpdate(id: string, updates: any) {
    return this.queueOperation({
      type: 'update',
      table: 'text_assignments',
      data: { match: { id }, updates }
    });
  }

  async queueTextAssignmentDelete(id: string) {
    return this.queueOperation({
      type: 'delete',
      table: 'text_assignments',
      data: { match: { id } }
    });
  }

  /**
   * Validate cached items against server when network returns
   */
  private async validateCacheOnNetworkReturn() {
    if (!this.isOnline) return;
    
    try {
      console.log('Network returned - validating cached items against server...');
      await cacheCoordinator.validateAllCachedItems();
      console.log('Cache validation completed');
    } catch (error) {
      console.error('Error validating cache on network return:', error);
    }
  }

  /**
   * Force cache validation (can be called manually)
   */
  async validateCache(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot validate cache while offline');
    }
    
    await cacheCoordinator.validateAllCachedItems();
  }

  // Get sync queue status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      pendingItems: this.syncQueue.map(item => ({
        id: item.id,
        type: item.type,
        table: item.table,
        retries: item.retries,
        timestamp: item.timestamp
      }))
    };
  }
}

export const backgroundSync = new BackgroundSync();