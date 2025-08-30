import { supabase } from '@/integrations/supabase/client';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version?: string;
}

export interface CacheConfig {
  maxAge: number; // in milliseconds
  maxSize: number; // in bytes
  storeName: string;
}

export class CacheManager {
  private dbName = 'OfflineCache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for document metadata
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'id' });
          metadataStore.createIndex('timestamp', 'timestamp');
          metadataStore.createIndex('folderId', 'folderId');
        }
        
        // Store for cover images
        if (!db.objectStoreNames.contains('covers')) {
          const coversStore = db.createObjectStore('covers', { keyPath: 'id' });
          coversStore.createIndex('timestamp', 'timestamp');
          coversStore.createIndex('size', 'size');
        }
        
        // Store for folders
        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('timestamp', 'timestamp');
        }
        
        // Store for cache metadata (versions, sizes, etc.)
        if (!db.objectStoreNames.contains('cache_meta')) {
          db.createObjectStore('cache_meta', { keyPath: 'key' });
        }
      };
    });
  }

  async set<T>(storeName: string, key: string, data: T, metadata?: any): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const entry: CacheEntry<T> & any = {
      id: key,
      data,
      timestamp: Date.now(),
      ...metadata
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Update cache size tracking
    await this.updateCacheSize(storeName);
  }

  async get<T>(storeName: string, key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<CacheEntry<T>[]> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async isStale(storeName: string, key: string, maxAge: number): Promise<boolean> {
    const entry = await this.get(storeName, key);
    if (!entry) return true;
    
    return Date.now() - entry.timestamp > maxAge;
  }

  async evictLRU(storeName: string, targetSize: number): Promise<void> {
    if (!this.db) await this.init();
    
    const entries = await this.getAll(storeName);
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    let currentSize = await this.getCacheSize(storeName);
    let i = 0;
    
    while (currentSize > targetSize && i < entries.length) {
      const entryId = (entries[i] as any).id;
      await this.delete(storeName, entryId);
      currentSize -= this.getEntrySize(entries[i]);
      i++;
    }
  }

  private async updateCacheSize(storeName: string): Promise<void> {
    const entries = await this.getAll(storeName);
    const size = entries.reduce((total, entry) => total + this.getEntrySize(entry), 0);
    
    await this.set('cache_meta', `${storeName}_size`, size);
  }

  private async getCacheSize(storeName: string): Promise<number> {
    const sizeEntry = await this.get('cache_meta', `${storeName}_size`);
    return sizeEntry?.data as number || 0;
  }

  private getEntrySize(entry: any): number {
    // Rough size calculation for cache management
    const jsonString = JSON.stringify(entry);
    return new Blob([jsonString]).size;
  }
}

export const cacheManager = new CacheManager();

// Helper functions for specific cache operations
export const coverCache = {
  async get(documentId: string) {
    return cacheManager.get<string>('covers', documentId);
  },
  
  async set(documentId: string, url: string, blob: Blob) {
    // Convert blob to base64 for storage
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    
    await cacheManager.set('covers', documentId, base64, { 
      size: blob.size,
      type: blob.type 
    });
  },
  
  async isStale(documentId: string) {
    return cacheManager.isStale('covers', documentId, 24 * 60 * 60 * 1000); // 24 hours
  }
};

export const metadataCache = {
  async get(key: string) {
    return cacheManager.get<any>('metadata', key);
  },
  
  async set(key: string, data: any) {
    await cacheManager.set('metadata', key, data);
  },
  
  async isStale(key: string) {
    return cacheManager.isStale('metadata', key, 5 * 60 * 1000); // 5 minutes
  }
};

export const folderCache = {
  async get(folderId: string) {
    return cacheManager.get<any>('folders', folderId);
  },
  
  async set(folderId: string, data: any) {
    await cacheManager.set('folders', folderId, data);
  },
  
  async getAll() {
    return cacheManager.getAll('folders');
  },
  
  async isStale(folderId: string) {
    return cacheManager.isStale('folders', folderId, 5 * 60 * 1000); // 5 minutes
  }
};