import { cacheManager, metadataCache } from './cacheManager';

// Enhanced cache entry with metadata for intelligent management
interface IntelligentCacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  accessCount: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  checksum?: string;
}

// Cache configuration for different data types
interface CacheStrategy {
  maxAge: number;
  maxSize: number;
  priority: 'high' | 'medium' | 'low';
  preloadRelated: boolean;
}

const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  folders: { maxAge: 10 * 60 * 1000, maxSize: 100, priority: 'high', preloadRelated: true },
  documents: { maxAge: 15 * 60 * 1000, maxSize: 500, priority: 'high', preloadRelated: true },
  worksheets: { maxAge: 30 * 60 * 1000, maxSize: 200, priority: 'medium', preloadRelated: false },
  covers: { maxAge: 60 * 60 * 1000, maxSize: 1000, priority: 'low', preloadRelated: false },
  user_sessions: { maxAge: 5 * 60 * 1000, maxSize: 50, priority: 'high', preloadRelated: false },
};

class IntelligentCacheManager {
  private storageQuota = 0;
  private usedStorage = 0;
  private networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
  private dependencyGraph = new Map<string, Set<string>>();

  constructor() {
    this.initializeStorageMonitoring();
    this.initializeNetworkMonitoring();
  }

  private async initializeStorageMonitoring() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      this.storageQuota = estimate.quota || 0;
      this.usedStorage = estimate.usage || 0;
    }
  }

  private initializeNetworkMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const updateNetworkSpeed = () => {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') this.networkSpeed = 'fast';
        else if (effectiveType === '3g') this.networkSpeed = 'medium';
        else this.networkSpeed = 'slow';
      };
      
      updateNetworkSpeed();
      connection.addEventListener('change', updateNetworkSpeed);
    }
  }

  // Intelligent cache set with metadata
  async setIntelligent<T>(
    category: string,
    key: string,
    data: T,
    options: {
      priority?: 'high' | 'medium' | 'low';
      dependencies?: string[];
      version?: string;
    } = {}
  ): Promise<void> {
    const strategy = CACHE_STRATEGIES[category] || CACHE_STRATEGIES.documents;
    const cacheKey = `${category}_${key}`;
    
    const entry: IntelligentCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: options.version || '1.0',
      accessCount: 1,
      lastAccessed: Date.now(),
      priority: options.priority || strategy.priority,
      dependencies: options.dependencies || [],
      checksum: this.generateChecksum(data),
    };

    // Update dependency graph
    if (options.dependencies) {
      this.dependencyGraph.set(cacheKey, new Set(options.dependencies));
    }

    // Check storage limits and cleanup if needed
    await this.ensureStorageCapacity(category);
    
    // Store the entry
    await metadataCache.set(cacheKey, entry);
    
    // Update storage usage
    this.updateStorageUsage();
  }

  // Intelligent cache get with access tracking
  async getIntelligent<T>(category: string, key: string): Promise<T | null> {
    const strategy = CACHE_STRATEGIES[category] || CACHE_STRATEGIES.documents;
    const cacheKey = `${category}_${key}`;
    
    const entry = await metadataCache.get(cacheKey) as IntelligentCacheEntry<T> | null;
    if (!entry) return null;

    // Check if cache is stale based on strategy and network speed
    const maxAge = this.getAdjustedMaxAge(strategy.maxAge);
    const isStale = Date.now() - entry.timestamp > maxAge;
    
    if (isStale) {
      // Don't delete immediately, might be useful for offline
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    await metadataCache.set(cacheKey, entry);

    // Validate data integrity
    if (entry.checksum && !this.validateChecksum(entry.data, entry.checksum)) {
      console.warn('Cache data integrity check failed for:', cacheKey);
      await cacheManager.delete('metadata', cacheKey);
      return null;
    }

    return entry.data;
  }

  // Invalidate cache with dependency resolution
  async invalidateWithDependencies(category: string, key: string): Promise<void> {
    const cacheKey = `${category}_${key}`;
    
    // Get all dependent keys
    const dependentKeys = this.findDependentKeys(cacheKey);
    
    // Invalidate the main key and all dependents
    const keysToInvalidate = [cacheKey, ...dependentKeys];
    
    await Promise.all(
      keysToInvalidate.map(k => cacheManager.delete('metadata', k))
    );

    // Update dependency graph
    this.dependencyGraph.delete(cacheKey);
  }

  // Predictive preloading based on user patterns
  async preloadRelated(category: string, key: string, userContext?: any): Promise<void> {
    const strategy = CACHE_STRATEGIES[category];
    if (!strategy.preloadRelated) return;

    if (category === 'folders') {
      // Preload documents for the selected folder
      await this.preloadFolderDocuments(key);
    } else if (category === 'documents') {
      // Preload adjacent documents and covers
      await this.preloadAdjacentDocuments(key, userContext);
    }
  }

  private async preloadFolderDocuments(folderId: string): Promise<void> {
    // This would trigger document loading for the folder
    // Implementation depends on the data structure
  }

  private async preloadAdjacentDocuments(documentId: string, context?: any): Promise<void> {
    // Logic to preload related documents based on user behavior
    if (context?.folderId) {
      // Preload other documents in the same folder
    }
  }

  // Storage management
  private async ensureStorageCapacity(category: string): Promise<void> {
    const strategy = CACHE_STRATEGIES[category];
    const usageRatio = this.usedStorage / this.storageQuota;
    
    if (usageRatio > 0.8) {
      await this.performIntelligentCleanup();
    }
  }

  private async performIntelligentCleanup(): Promise<void> {
    // Get all cache entries with metadata
    const allEntries = await this.getAllCacheEntries();
    
    // Sort by priority and access patterns (LRU with priority)
    const sortedEntries = allEntries.sort((a, b) => {
      // Priority first
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by last accessed time
      return a.lastAccessed - b.lastAccessed;
    });

    // Remove the least important 20% of entries
    const toRemove = sortedEntries.slice(0, Math.floor(sortedEntries.length * 0.2));
    await Promise.all(
      toRemove.map(entry => cacheManager.delete('metadata', entry.key))
    );

    this.updateStorageUsage();
  }

  private async getAllCacheEntries(): Promise<Array<IntelligentCacheEntry<any> & { key: string }>> {
    // This would need to be implemented based on the cache structure
    return [];
  }

  // Network-aware cache strategies
  private getAdjustedMaxAge(baseMaxAge: number): number {
    switch (this.networkSpeed) {
      case 'slow': return baseMaxAge * 2; // Keep cache longer on slow networks
      case 'fast': return baseMaxAge * 0.5; // Refresh more often on fast networks
      default: return baseMaxAge;
    }
  }

  // Data integrity
  private generateChecksum<T>(data: T): string {
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private validateChecksum<T>(data: T, expectedChecksum: string): boolean {
    const actualChecksum = this.generateChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  // Dependency graph management
  private findDependentKeys(key: string): string[] {
    const dependents: string[] = [];
    
    for (const [entryKey, dependencies] of this.dependencyGraph.entries()) {
      if (dependencies.has(key)) {
        dependents.push(entryKey);
      }
    }
    
    return dependents;
  }

  private updateStorageUsage(): void {
    // Update storage usage metrics - implementation would depend on IndexedDB size calculation
  }

  // Network status methods
  getNetworkSpeed(): 'slow' | 'medium' | 'fast' {
    return this.networkSpeed;
  }

  getStorageStatus(): { used: number; quota: number; ratio: number } {
    return {
      used: this.usedStorage,
      quota: this.storageQuota,
      ratio: this.storageQuota > 0 ? this.usedStorage / this.storageQuota : 0
    };
  }
}

export const intelligentCache = new IntelligentCacheManager();