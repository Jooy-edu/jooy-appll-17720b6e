import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from './documentStore';
import { getOfflineUser } from './offlineAuth';
import { networkService } from './networkService';
import { offlineActionQueue } from './offlineActionQueue';

// Import QueryClient from a separate module to avoid circular imports
let queryClient: QueryClient;

// Function to set the query client reference
export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

interface SyncResponse {
  documents: any[];
  covers: any[];
  deletedCovers?: string[];
  lastUpdated: number;
  tombstones?: string[];
}

class BackgroundSyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private lastSyncAttempt = 0;
  private minSyncInterval = 30000; // 30 seconds minimum between syncs
  private batchQueue: Array<{ type: string; id: string; priority: 'high' | 'medium' | 'low' }> = [];
  private batchProcessingTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay = 2000; // 2 seconds batch delay

  constructor() {
    this.setupEventListeners();
    this.initializeStore();
  }

  private async initializeStore() {
    try {
      await documentStore.initialize();
    } catch (error) {
      console.error('Failed to initialize document store:', error);
    }
  }

  private setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncDocuments();
      this.syncFolders();
      this.syncLevelActivations();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        this.syncDocuments();
        this.syncFolders();
        this.syncLevelActivations();
      }
    });

    // App focus
    window.addEventListener('focus', () => {
      if (this.isOnline) {
        this.syncDocuments();
        this.syncFolders();
        this.syncLevelActivations();
      }
    });
  }

  async syncDocuments(force = false): Promise<boolean> {
    if (!this.isOnline && !force) {
      // Queue for later when online
      offlineActionQueue.enqueue({
        type: 'sync',
        payload: { syncType: 'documents' },
        priority: 'medium',
      });
      return false;
    }
    
    if (this.syncInProgress) return false;
    
    const now = Date.now();
    if (!force && now - this.lastSyncAttempt < this.minSyncInterval) {
      return false;
    }

    this.syncInProgress = true;
    this.lastSyncAttempt = now;

    try {
      const lastSync = await documentStore.getLastSyncTimestamp();
      const settings = networkService.getOptimalSettings();
      
      // Use enhanced network service for delta sync
      const response = await networkService.supabaseWithRetry('sync-documents', 
        { since: lastSync },
        {
          timeout: settings.timeout,
          retryConfig: settings.retryConfig,
          conditionalRequest: true,
        }
      );

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const syncData: SyncResponse = await response.json();
      
      if (syncData.documents?.length > 0) {
        // Save new/updated documents
        await documentStore.saveDocuments(syncData.documents, syncData.lastUpdated);
        
        // Invalidate React Query cache to trigger re-renders
        queryClient?.invalidateQueries({ queryKey: ['documents'] });
      }

      if (syncData.covers?.length > 0) {
        // Batch process covers for efficiency
        await this.batchProcessCovers(syncData.covers);
        
        // Invalidate cover-related queries
        queryClient?.invalidateQueries({ queryKey: ['covers'] });
      }

      // Handle deleted covers
      if (syncData.deletedCovers?.length > 0) {
        for (const documentId of syncData.deletedCovers) {
          await documentStore.deleteCover(documentId);
        }
        queryClient?.invalidateQueries({ queryKey: ['covers'] });
      }

      // Handle deletions
      if (syncData.tombstones?.length > 0) {
        for (const documentId of syncData.tombstones) {
          await documentStore.deleteDocument(documentId);
          await documentStore.deleteCover(documentId);
          await documentStore.deleteWorksheetData(documentId);
        }
        queryClient?.invalidateQueries({ queryKey: ['documents'] });
      }

      // Clean up old data (older than 30 days)
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      await documentStore.clearOldData(thirtyDaysAgo);

      return true;
    } catch (error) {
      console.error('Document sync failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncFolders(force = false): Promise<boolean> {
    if (!this.isOnline && !force) return false;
    if (this.syncInProgress) return false;

    try {
      // Get current user first
      const { user } = await getOfflineUser();
      
      // Fetch all folders with their documents
      const { data, error } = await supabase
        .from('folders')
        .select(`
          *,
          documents(id, is_private, user_id)
        `)
        .order('name');
      
      if (error) throw error;
      
      // Filter folders: user's own folders OR folders with public documents
      const filteredData = data?.filter(folder => 
        folder.user_id === user?.id ||
        folder.documents?.some((doc: any) => !doc.is_private)
      ) || [];
      
      // Save folders to cache
      if (filteredData.length > 0) {
        await documentStore.saveFolders(filteredData, Date.now());
      }

      // Invalidate folder queries
      queryClient?.invalidateQueries({ queryKey: ['folders'] });

      console.log(`Folder sync completed: ${filteredData.length} folders`);
      return true;

    } catch (error) {
      console.error('Folder sync failed:', error);
      return false;
    }
  }

  async syncLevelActivations(force = false): Promise<boolean> {
    if (!this.isOnline && !force) return false;
    if (this.syncInProgress) return false;

    try {
      // Get current user first
      const { user } = await getOfflineUser();
      if (!user) return false;
      
      // Fetch user's level activations
      const { data, error } = await supabase
        .from('user_level_activations')
        .select(`
          *,
          folders(id, name)
        `)
        .eq('user_id', user.id)
        .order('activated_at', { ascending: false });
      
      if (error) throw error;
      
      // Save activations to cache
      if (data && data.length > 0) {
        await documentStore.saveLevelActivations(data);
      }

      // Invalidate level access queries
      queryClient?.invalidateQueries({ queryKey: ['level-access'] });
      queryClient?.invalidateQueries({ queryKey: ['user-level-activations'] });

      console.log(`Level activations sync completed: ${data?.length || 0} activations`);
      return true;

    } catch (error) {
      console.error('Level activations sync failed:', error);
      return false;
    }
  }


  // Batch processing for covers to reduce network overhead
  private async batchProcessCovers(covers: any[]): Promise<void> {
    const settings = networkService.getOptimalSettings();
    const batchSize = settings.batchSize;
    
    for (let i = 0; i < covers.length; i += batchSize) {
      const batch = covers.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (cover) => {
          try {
            if (typeof cover === 'object' && cover.documentId) {
              // Check if cover needs updating based on timestamp
              if (cover.updatedAt) {
                const { updateCoverIfChanged } = await import('@/utils/coverBlobCache');
                await updateCoverIfChanged(cover.documentId, cover.updatedAt);
              } else {
                // Queue for background download
                offlineActionQueue.enqueue({
                  type: 'download',
                  payload: {
                    type: 'cover',
                    documentId: cover.documentId,
                    url: `/api/covers/${cover.documentId}`,
                  },
                  priority: 'low',
                });
              }
            }
          } catch (error) {
            console.warn(`Failed to sync cover for ${cover.documentId}:`, error);
          }
        })
      );
      
      // Small delay between batches to prevent overwhelming the network
      if (i + batchSize < covers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // Enhanced manual sync with better error handling
  async manualSync(): Promise<{ success: boolean; message: string }> {
    if (!this.isOnline) {
      const queueStatus = offlineActionQueue.getQueueStatus();
      return { 
        success: false, 
        message: `No internet connection. ${queueStatus.pending} actions queued for when online.` 
      };
    }

    try {
      const [docsSuccess, foldersSuccess, levelsSuccess] = await Promise.allSettled([
        this.syncDocuments(true),
        this.syncFolders(true),
        this.syncLevelActivations(true),
      ]);

      const results = [
        { name: 'Documents', success: docsSuccess.status === 'fulfilled' && docsSuccess.value },
        { name: 'Folders', success: foldersSuccess.status === 'fulfilled' && foldersSuccess.value },
        { name: 'Levels', success: levelsSuccess.status === 'fulfilled' && levelsSuccess.value },
      ];

      const successful = results.filter(r => r.success).length;
      const total = results.length;

      if (successful === total) {
        return { success: true, message: 'All data synced successfully' };
      } else if (successful > 0) {
        return { success: true, message: `Partial sync: ${successful}/${total} completed` };
      } else {
        return { success: false, message: 'Sync failed for all data types' };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Sync failed: ' + (error as Error).message
      };
    }
  }

  isOffline(): boolean {
    return !this.isOnline;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  getNetworkQuality() {
    return networkService.getConnectionQuality();
  }

  getQueuedActionsCount(): number {
    return offlineActionQueue.getQueueStatus().pending;
  }
}

export const backgroundSyncService = new BackgroundSyncService();