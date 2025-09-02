interface CachedDocument {
  id: string;
  data: any;
  updatedAt: number;
  syncVersion: number;
}

interface CachedFolder {
  id: string;
  data: any;
  updatedAt: number;
  syncVersion: number;
}

interface CachedUser {
  id: string;
  email: string | null;
  user_metadata: any;
  profile?: any;
  updatedAt: number;
}

interface CachedLevelActivation {
  id: string;
  data: any;
  updatedAt: number;
}

interface DocumentStoreState {
  documents: Record<string, CachedDocument>;
  covers: Record<string, { url: string; updatedAt: number }>;
  lastSyncTimestamp: number;
  version: number;
}

class DocumentStore {
  private dbName = 'JooyOfflineStore';
  private version = 3; // Increment version for new levelActivations store
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
          documentsStore.createIndex('updatedAt', 'updatedAt');
        }

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('updatedAt', 'updatedAt');
        }

        // Covers store
        if (!db.objectStoreNames.contains('covers')) {
          const coversStore = db.createObjectStore('covers', { keyPath: 'id' });
          coversStore.createIndex('updatedAt', 'updatedAt');
        }

        // Worksheet data store (for JSON files)
        if (!db.objectStoreNames.contains('worksheetData')) {
          const worksheetStore = db.createObjectStore('worksheetData', { keyPath: 'id' });
          worksheetStore.createIndex('updatedAt', 'updatedAt');
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        // User session store
        if (!db.objectStoreNames.contains('userSession')) {
          db.createObjectStore('userSession', { keyPath: 'key' });
        }

        // Level activations store
        if (!db.objectStoreNames.contains('levelActivations')) {
          const activationsStore = db.createObjectStore('levelActivations', { keyPath: 'id' });
          activationsStore.createIndex('updatedAt', 'updatedAt');
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) throw new Error('Failed to initialize database');
    return this.db;
  }

  async getDocuments(folderId?: string): Promise<CachedDocument[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['documents'], 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.getAll();

      request.onsuccess = () => {
        let documents = request.result || [];
        
        // Filter by folder if specified
        if (folderId) {
          documents = documents.filter((doc: CachedDocument) => 
            doc.data.folder_id === folderId
          );
        }
        
        resolve(documents);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async saveDocuments(documents: any[], timestamp: number): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['documents', 'metadata'], 'readwrite');
      
      // Save documents
      const documentsStore = transaction.objectStore('documents');
      documents.forEach(doc => {
        const cachedDoc: CachedDocument = {
          id: doc.id,
          data: doc,
          updatedAt: new Date(doc.updated_at || doc.created_at).getTime(),
          syncVersion: timestamp,
        };
        documentsStore.put(cachedDoc);
      });

      // Update last sync timestamp
      const metadataStore = transaction.objectStore('metadata');
      metadataStore.put({ key: 'lastSyncTimestamp', value: timestamp });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getLastSyncTimestamp(): Promise<number> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('lastSyncTimestamp');

      request.onsuccess = () => {
        resolve(request.result?.value || 0);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async saveCover(documentId: string, url: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['covers'], 'readwrite');
      const store = transaction.objectStore('covers');
      
      store.put({
        id: documentId,
        url,
        updatedAt: Date.now(),
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCover(documentId: string): Promise<string | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['covers'], 'readonly');
      const store = transaction.objectStore('covers');
      const request = store.get(documentId);

      request.onsuccess = () => {
        resolve(request.result?.url || null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getFolders(): Promise<CachedFolder[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['folders'], 'readonly');
      const store = transaction.objectStore('folders');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async saveFolders(folders: any[], timestamp: number): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['folders', 'metadata'], 'readwrite');
      
      // Save folders
      const foldersStore = transaction.objectStore('folders');
      folders.forEach(folder => {
        const cachedFolder: CachedFolder = {
          id: folder.id,
          data: folder,
          updatedAt: new Date(folder.updated_at || folder.created_at).getTime(),
          syncVersion: timestamp,
        };
        foldersStore.put(cachedFolder);
      });

      // Update last folder sync timestamp
      const metadataStore = transaction.objectStore('metadata');
      metadataStore.put({ key: 'lastFolderSyncTimestamp', value: timestamp });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveWorksheetData(folderId: string, data: any, timestamp: number): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['worksheetData'], 'readwrite');
      const store = transaction.objectStore('worksheetData');
      
      store.put({
        id: folderId,
        data,
        updatedAt: timestamp,
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getWorksheetData(folderId: string): Promise<any | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['worksheetData'], 'readonly');
      const store = transaction.objectStore('worksheetData');
      const request = store.get(folderId);

      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldData(olderThan: number): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['documents', 'folders', 'covers', 'worksheetData', 'levelActivations'], 'readwrite');
      
      // Clear old documents
      const documentsStore = transaction.objectStore('documents');
      const documentsIndex = documentsStore.index('updatedAt');
      const documentsRange = IDBKeyRange.upperBound(olderThan);
      documentsIndex.openCursor(documentsRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Clear old folders
      const foldersStore = transaction.objectStore('folders');
      const foldersIndex = foldersStore.index('updatedAt');
      const foldersRange = IDBKeyRange.upperBound(olderThan);
      foldersIndex.openCursor(foldersRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Clear old covers
      const coversStore = transaction.objectStore('covers');
      const coversIndex = coversStore.index('updatedAt');
      const coversRange = IDBKeyRange.upperBound(olderThan);
      coversIndex.openCursor(coversRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Clear old worksheet data
      const worksheetStore = transaction.objectStore('worksheetData');
      const worksheetIndex = worksheetStore.index('updatedAt');
      const worksheetRange = IDBKeyRange.upperBound(olderThan);
      worksheetIndex.openCursor(worksheetRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Clear old level activations
      const activationsStore = transaction.objectStore('levelActivations');
      const activationsIndex = activationsStore.index('updatedAt');
      const activationsRange = IDBKeyRange.upperBound(olderThan);
      activationsIndex.openCursor(activationsRange).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveUserSession(user: any, profile?: any): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readwrite');
      const store = transaction.objectStore('userSession');
      
      const cachedUser: CachedUser = {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        profile: profile,
        updatedAt: Date.now(),
      };

      store.put({
        key: 'currentUser',
        value: cachedUser,
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedUser(): Promise<CachedUser | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readonly');
      const store = transaction.objectStore('userSession');
      const request = store.get('currentUser');

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearUserSession(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession', 'levelActivations'], 'readwrite');
      const userStore = transaction.objectStore('userSession');
      const activationsStore = transaction.objectStore('levelActivations');
      
      userStore.delete('currentUser');
      activationsStore.clear(); // Clear all level activations on logout

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveLevelActivations(activations: any[]): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['levelActivations'], 'readwrite');
      const store = transaction.objectStore('levelActivations');
      
      activations.forEach(activation => {
        const cached: CachedLevelActivation = {
          id: activation.folder_id,
          data: activation,
          updatedAt: Date.now(),
        };
        store.put(cached);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getLevelActivations(): Promise<CachedLevelActivation[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['levelActivations'], 'readonly');
      const store = transaction.objectStore('levelActivations');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getLevelActivation(folderId: string): Promise<CachedLevelActivation | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['levelActivations'], 'readonly');
      const store = transaction.objectStore('levelActivations');
      const request = store.get(folderId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}

export const documentStore = new DocumentStore();