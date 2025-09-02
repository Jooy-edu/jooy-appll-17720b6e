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

interface DocumentStoreState {
  documents: Record<string, CachedDocument>;
  covers: Record<string, { url: string; updatedAt: number }>;
  lastSyncTimestamp: number;
  version: number;
}

class DocumentStore {
  private dbName = 'JooyOfflineStore';
  private version = 1;
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
      const transaction = db.transaction(['documents', 'folders', 'covers', 'worksheetData'], 'readwrite');
      
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

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const documentStore = new DocumentStore();