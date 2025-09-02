import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from './documentStore';
import { getOfflineUser } from './offlineAuth';

// Import QueryClient from a separate module to avoid circular imports
let queryClient: QueryClient;

// Function to set the query client reference
export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

interface SyncResponse {
  documents: any[];
  covers: any[];
  lastUpdated: number;
  tombstones?: string[];
}

class BackgroundSyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private lastSyncAttempt = 0;
  private minSyncInterval = 30000; // 30 seconds minimum between syncs

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
    if (!this.isOnline && !force) return false;
    if (this.syncInProgress) return false;
    
    const now = Date.now();
    if (!force && now - this.lastSyncAttempt < this.minSyncInterval) {
      return false;
    }

    this.syncInProgress = true;
    this.lastSyncAttempt = now;

    try {
      const lastSync = await documentStore.getLastSyncTimestamp();
      
      // Call our sync endpoint
      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: { since: lastSync },
      });

      if (error) throw error;

      const syncData: SyncResponse = data;
      
      if (syncData.documents?.length > 0) {
        // Save new/updated documents
        await documentStore.saveDocuments(syncData.documents, syncData.lastUpdated);
        
        // Invalidate React Query cache to trigger re-renders
        queryClient?.invalidateQueries({ queryKey: ['documents'] });
      }

      if (syncData.covers?.length > 0) {
        // Update cover cache
        for (const cover of syncData.covers) {
          await documentStore.saveCover(cover.documentId, cover.url);
        }
        
        // Invalidate cover-related queries
        queryClient?.invalidateQueries({ queryKey: ['covers'] });
      }

      // Handle deletions
      if (syncData.tombstones?.length > 0) {
        // TODO: Implement document deletion from cache
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

  async manualSync(): Promise<{ success: boolean; message: string }> {
    if (!this.isOnline) {
      return { success: false, message: 'No internet connection' };
    }

    try {
      const success = await this.syncDocuments(true);
      return {
        success,
        message: success ? 'Documents synced successfully' : 'No new updates available'
      };
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
}

export const backgroundSyncService = new BackgroundSyncService();