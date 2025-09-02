interface QueuedAction {
  id: string;
  type: 'sync' | 'upload' | 'download';
  payload: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
}

class OfflineActionQueue {
  private queue: QueuedAction[] = [];
  private processing = false;
  private maxRetries = 3;
  private storageKey = 'offline-action-queue';

  constructor() {
    this.loadQueue();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Process queue when online
    window.addEventListener('online', () => {
      this.processQueue();
    });

    // Save queue before page unload
    window.addEventListener('beforeunload', () => {
      this.saveQueue();
    });

    // Save queue periodically
    setInterval(() => {
      this.saveQueue();
    }, 30000); // Every 30 seconds
  }

  private loadQueue() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load offline action queue:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to save offline action queue:', error);
    }
  }

  enqueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>) {
    const queuedAction: QueuedAction = {
      ...action,
      id: `${action.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(item => 
      this.getPriorityValue(item.priority) < this.getPriorityValue(action.priority)
    );

    if (insertIndex === -1) {
      this.queue.push(queuedAction);
    } else {
      this.queue.splice(insertIndex, 0, queuedAction);
    }

    this.saveQueue();

    // Try to process immediately if online
    if (navigator.onLine && !this.processing) {
      this.processQueue();
    }

    return queuedAction.id;
  }

  private getPriorityValue(priority: QueuedAction['priority']): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  async processQueue() {
    if (this.processing || !navigator.onLine) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const action = this.queue[0];

        try {
          await this.executeAction(action);
          
          // Remove successful action
          this.queue.shift();
          console.log(`Successfully processed queued action: ${action.type}`);
        } catch (error) {
          console.warn(`Failed to process queued action: ${action.type}`, error);
          
          action.retryCount++;
          
          if (action.retryCount >= this.maxRetries) {
            // Remove failed action after max retries
            this.queue.shift();
            console.error(`Giving up on queued action after ${this.maxRetries} retries:`, action);
          } else {
            // Move to end of queue for retry
            this.queue.push(this.queue.shift()!);
          }
        }

        // Break if we go offline during processing
        if (!navigator.onLine) {
          break;
        }
      }
    } finally {
      this.processing = false;
      this.saveQueue();
    }
  }

  private async executeAction(action: QueuedAction): Promise<void> {
    const { networkService } = await import('./networkService');
    
    switch (action.type) {
      case 'sync':
        return this.executeSyncAction(action);
      case 'upload':
        return this.executeUploadAction(action);
      case 'download':
        return this.executeDownloadAction(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeSyncAction(action: QueuedAction): Promise<void> {
    const { backgroundSyncService } = await import('./backgroundSyncService');
    
    switch (action.payload.syncType) {
      case 'documents':
        await backgroundSyncService.syncDocuments(true);
        break;
      case 'folders':
        await backgroundSyncService.syncFolders(true);
        break;
      case 'levelActivations':
        await backgroundSyncService.syncLevelActivations(true);
        break;
      default:
        throw new Error(`Unknown sync type: ${action.payload.syncType}`);
    }
  }

  private async executeUploadAction(action: QueuedAction): Promise<void> {
    // Implement upload logic (e.g., user profile updates, preferences)
    throw new Error('Upload actions not yet implemented');
  }

  private async executeDownloadAction(action: QueuedAction): Promise<void> {
    const { networkService } = await import('./networkService');
    
    const response = await networkService.fetchWithRetry(action.payload.url, {
      conditionalRequest: true,
      retryConfig: { maxRetries: 2 },
    });

    if (response.status === 304) {
      // Not modified, nothing to do
      return;
    }

    // Process downloaded content (e.g., cache covers, worksheet data)
    if (action.payload.type === 'cover') {
      const blob = await response.blob();
      const { documentStore } = await import('./documentStore');
      await documentStore.saveCover(action.payload.documentId, blob);
    }
  }

  getQueueStatus() {
    return {
      pending: this.queue.length,
      processing: this.processing,
      oldestAction: this.queue[0]?.timestamp || null,
    };
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }

  // Remove specific action by ID
  removeAction(id: string): boolean {
    const index = this.queue.findIndex(action => action.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveQueue();
      return true;
    }
    return false;
  }
}

export const offlineActionQueue = new OfflineActionQueue();