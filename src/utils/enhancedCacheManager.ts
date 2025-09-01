import { cacheManager, metadataCache } from './cacheManager';

// Enhanced cache entry with intelligent metadata
interface EnhancedCacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  accessCount: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  checksum?: string;
  category: string;
}

// Cache strategies for different data types
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

class EnhancedCacheManager {
  private storageQuota = 0;
  private usedStorage = 0;
  private networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
  private dependencyGraph = new Map<string, Set<string>>();
  private networkConnection: any = null;

  constructor() {
    this.initializeStorageMonitoring();
    this.initializeNetworkMonitoring();
    cacheManager.init().catch(console.error);
  }

  private async initializeStorageMonitoring() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        this.storageQuota = estimate.quota || 0;
        this.usedStorage = estimate.usage || 0;
      }
    } catch (error) {
      console.warn('Storage estimation not supported');
    }
  }

  private initializeNetworkMonitoring() {
    try {
      if ('connection' in navigator) {
        this.networkConnection = (navigator as any).connection;
        const updateNetworkSpeed = () => {
          const effectiveType = this.networkConnection?.effectiveType;
          if (effectiveType === '4g') this.networkSpeed = 'fast';
          else if (effectiveType === '3g') this.networkSpeed = 'medium';
          else this.networkSpeed = 'slow';
        };
        
        updateNetworkSpeed();
        this.networkConnection?.addEventListener?.('change', updateNetworkSpeed);
      }
    } catch (error) {
      console.warn('Network connection API not supported');
    }
  }

  // Enhanced cache set with proper IndexedDB integration
  async setEnhanced<T>(
    category: string,
    key: string,
    data: T,
    options: {
      priority?: 'high' | 'medium' | 'low';
      dependencies?: string[];
      version?: string;
    } = {}
  ): Promise<void> {
    try {
      const strategy = CACHE_STRATEGIES[category] || CACHE_STRATEGIES.documents;
      const cacheKey = `${category}_${key}`;
      
      const entry: EnhancedCacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: options.version || '1.0',
        accessCount: 1,
        lastAccessed: Date.now(),
        priority: options.priority || strategy.priority,
        dependencies: options.dependencies || [],
        checksum: this.generateChecksum(data),
        category,
      };

      // Update dependency graph
      if (options.dependencies) {
        this.dependencyGraph.set(cacheKey, new Set(options.dependencies));
      }

      // Check storage limits and cleanup if needed
      await this.ensureStorageCapacity(category);
      
      // Store using the existing cache manager
      await metadataCache.set(cacheKey, entry);
      
      // Update storage usage
      await this.updateStorageUsage();
    } catch (error) {
      console.error('Enhanced cache set failed:', error);
      // Fallback to basic caching
      await metadataCache.set(`${category}_${key}`, { data, timestamp: Date.now() });
    }
  }

  // Enhanced cache get with access tracking
  async getEnhanced<T>(category: string, key: string): Promise<T | null> {
    try {
      const strategy = CACHE_STRATEGIES[category] || CACHE_STRATEGIES.documents;
      const cacheKey = `${category}_${key}`;
      
      const cached = await metadataCache.get(cacheKey);
      if (!cached?.data) return null;

      const entry = cached.data as EnhancedCacheEntry<T>;
      
      // Check if cache is stale based on strategy and network speed
      const maxAge = this.getAdjustedMaxAge(strategy.maxAge);
      const isStale = Date.now() - entry.timestamp > maxAge;
      
      if (isStale) {
        return null; // Don't delete immediately for offline support
      }

      // Update access metadata for enhanced entries
      if (entry.accessCount !== undefined) {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        await metadataCache.set(cacheKey, entry);
      }

      // Validate data integrity if checksum exists
      if (entry.checksum && !this.validateChecksum(entry.data, entry.checksum)) {
        console.warn('Cache data integrity check failed for:', cacheKey);
        await this.delete(category, key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Enhanced cache get failed:', error);
      // Fallback to basic cache
      const cached = await metadataCache.get(`${category}_${key}`);
      return cached?.data?.data || cached?.data || null;
    }
  }

  // Delete cache entry
  async delete(category: string, key: string): Promise<void> {
    const cacheKey = `${category}_${key}`;
    await cacheManager.delete('metadata', cacheKey);
    this.dependencyGraph.delete(cacheKey);
  }

  // Invalidate cache with dependency resolution
  async invalidateWithDependencies(category: string, key: string): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  // Predictive preloading based on user patterns
  async preloadRelated(category: string, key: string, userContext?: any): Promise<void> {
    const strategy = CACHE_STRATEGIES[category];
    if (!strategy?.preloadRelated) return;

    try {
      if (category === 'folders') {
        await this.preloadFolderDocuments(key, userContext);
      } else if (category === 'documents') {
        await this.preloadAdjacentDocuments(key, userContext);
      }
    } catch (error) {
      console.error('Preloading failed:', error);
    }
  }

  private async preloadFolderDocuments(folderId: string, context?: any): Promise<void> {
    // Mark for background preloading - implementation depends on data access patterns
    console.log('Preloading documents for folder:', folderId);
  }

  private async preloadAdjacentDocuments(documentId: string, context?: any): Promise<void> {
    // Logic to preload related documents based on user behavior
    if (context?.folderId) {
      console.log('Preloading adjacent documents in folder:', context.folderId);
    }
  }

  // Storage management
  private async ensureStorageCapacity(category: string): Promise<void> {
    try {
      await this.updateStorageUsage();
      const usageRatio = this.storageQuota > 0 ? this.usedStorage / this.storageQuota : 0;
      
      if (usageRatio > 0.85) {
        await this.performIntelligentCleanup();
      }
    } catch (error) {
      console.error('Storage capacity check failed:', error);
    }
  }

  private async performIntelligentCleanup(): Promise<void> {
    try {
      // Get all metadata entries
      const allEntries = await cacheManager.getAll('metadata');
      
      // Filter and sort enhanced entries by priority and access patterns
      const enhancedEntries = allEntries
        .filter(entry => {
          const data = entry.data as EnhancedCacheEntry<any>;
          return data?.category && data?.accessCount !== undefined;
        })
        .map(entry => {
          const data = entry.data as EnhancedCacheEntry<any>;
          return {
            key: (entry as any).id,
            ...data,
          };
        })
        .sort((a: any, b: any) => {
          // Priority first
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          
          // Then by last accessed time
          return a.lastAccessed - b.lastAccessed;
        });

      // Remove the least important 20% of enhanced entries
      const toRemove = enhancedEntries.slice(0, Math.floor(enhancedEntries.length * 0.2));
      await Promise.all(
        toRemove.map((entry: any) => cacheManager.delete('metadata', entry.key))
      );

      await this.updateStorageUsage();
    } catch (error) {
      console.error('Intelligent cleanup failed:', error);
    }
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
    try {
      return btoa(JSON.stringify(data)).slice(0, 16);
    } catch {
      return '';
    }
  }

  private validateChecksum<T>(data: T, expectedChecksum: string): boolean {
    try {
      const actualChecksum = this.generateChecksum(data);
      return actualChecksum === expectedChecksum;
    } catch {
      return true; // If validation fails, assume data is valid
    }
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

  private async updateStorageUsage(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        this.usedStorage = estimate.usage || 0;
      }
    } catch (error) {
      console.warn('Storage usage update failed');
    }
  }

  // Public API methods
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

  // Clear all cache for a category
  async clearCategory(category: string): Promise<void> {
    try {
      const allEntries = await cacheManager.getAll('metadata');
      const categoryEntries = allEntries.filter(entry => 
        (entry as any).id?.startsWith(`${category}_`)
      );
      
      await Promise.all(
        categoryEntries.map(entry => 
          cacheManager.delete('metadata', (entry as any).id)
        )
      );
    } catch (error) {
      console.error('Clear category failed:', error);
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalEntries: number;
    categoryCounts: Record<string, number>;
    storageUsage: { used: number; quota: number; ratio: number };
    networkSpeed: string;
  }> {
    try {
      const allEntries = await cacheManager.getAll('metadata');
      const categoryCounts: Record<string, number> = {};
      
      allEntries.forEach(entry => {
        const data = entry.data as EnhancedCacheEntry<any>;
        if (data?.category) {
          categoryCounts[data.category] = (categoryCounts[data.category] || 0) + 1;
        }
      });

      return {
        totalEntries: allEntries.length,
        categoryCounts,
        storageUsage: this.getStorageStatus(),
        networkSpeed: this.networkSpeed,
      };
    } catch (error) {
      console.error('Get cache stats failed:', error);
      return {
        totalEntries: 0,
        categoryCounts: {},
        storageUsage: this.getStorageStatus(),
        networkSpeed: this.networkSpeed,
      };
    }
  }
}

export const enhancedCache = new EnhancedCacheManager();