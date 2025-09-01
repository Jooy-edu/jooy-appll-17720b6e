import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cacheManager';
import { enhancedCache } from './enhancedCacheManager';
import { intelligentCache } from './intelligentCacheManager';
import { QueryClient } from '@tanstack/react-query';

// Create a query client instance if not already available
const globalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Try to get existing query client from window or use our global one
const getQueryClient = () => {
  if (typeof window !== 'undefined' && (window as any).__REACT_QUERY_CLIENT__) {
    return (window as any).__REACT_QUERY_CLIENT__;
  }
  return globalQueryClient;
};

export interface CacheVersion {
  key: string;
  version: string;
  etag?: string;
  lastModified?: string;
  checksum?: string;
}

export interface ValidationResult {
  isValid: boolean;
  hasServerChanges: boolean;
  newVersion?: string;
  error?: string;
}

export interface CacheInvalidationEvent {
  type: 'cover' | 'document' | 'worksheet' | 'folder';
  id: string;
  action: 'update' | 'delete' | 'create';
  cascadeKeys?: string[];
}

export class CacheCoordinator {
  private validationQueue: Set<string> = new Set();
  private isValidating = false;
  private networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';

  constructor() {
    this.initNetworkMonitoring();
  }

  private initNetworkMonitoring() {
    // Monitor network speed for adaptive validation
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.networkSpeed = connection.effectiveType === '4g' ? 'fast' : 
                         connection.effectiveType === '3g' ? 'medium' : 'slow';
      
      connection.addEventListener('change', () => {
        this.networkSpeed = connection.effectiveType === '4g' ? 'fast' : 
                           connection.effectiveType === '3g' ? 'medium' : 'slow';
      });
    }
  }

  /**
   * Validate a cached item against server version
   */
  async validateCacheItem(type: 'cover' | 'document' | 'worksheet', id: string): Promise<ValidationResult> {
    try {
      const cachedVersion = await cacheManager.get<{version: string; etag?: string}>('cache_meta', `${type}_${id}_version`);
      
      let serverVersion: string | null = null;
      let serverEtag: string | null = null;

      switch (type) {
        case 'cover':
          serverVersion = await this.getCoverVersion(id);
          break;
        case 'document':
          serverVersion = await this.getDocumentVersion(id);
          break;
        case 'worksheet':
          const worksheetInfo = await this.getWorksheetVersion(id);
          serverVersion = worksheetInfo.version;
          serverEtag = worksheetInfo.etag;
          break;
      }

      const hasServerChanges = !cachedVersion || 
                              cachedVersion.data?.version !== serverVersion ||
                              (serverEtag && cachedVersion.data?.etag !== serverEtag);

      return {
        isValid: !hasServerChanges,
        hasServerChanges,
        newVersion: serverVersion || undefined
      };

    } catch (error) {
      console.error(`Error validating cache for ${type}:${id}:`, error);
      return {
        isValid: false,
        hasServerChanges: true,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Get cover version from server (enhanced with better metadata detection)
   */
  private async getCoverVersion(documentId: string): Promise<string | null> {
    try {
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];
      
      for (const ext of extensions) {
        const filePath = `${documentId}.${ext}`;
        
        // First try to list the file to get metadata
        const { data: fileList, error: listError } = await supabase.storage
          .from('covers')
          .list('', { search: filePath, limit: 1 });

        if (!listError && fileList && fileList.length > 0) {
          const file = fileList[0];
          
          // Create a comprehensive version identifier
          const versionComponents = [
            file.updated_at || file.created_at,
            file.metadata?.size || 0,
            file.metadata?.httpStatusCode || 'unknown',
            file.id || filePath
          ];
          
          return versionComponents.join('_');
        }
        
        // Fallback: try HEAD request to signed URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from('covers')
          .createSignedUrl(filePath, 60);

        if (!urlError && urlData?.signedUrl) {
          try {
            const response = await fetch(urlData.signedUrl, { method: 'HEAD' });
            if (response.ok) {
              const lastModified = response.headers.get('last-modified');
              const contentLength = response.headers.get('content-length');
              const etag = response.headers.get('etag');
              
              return `${lastModified || Date.now()}_${contentLength || 0}_${etag?.replace(/"/g, '') || 'no-etag'}`;
            }
          } catch (headError) {
            console.warn('HEAD request failed for cover:', filePath, headError);
          }
        }
      }
      return null; // No cover found
    } catch (error) {
      console.error('Error getting cover version:', error);
      return null;
    }
  }

  /**
   * Get document version from database
   */
  private async getDocumentVersion(documentId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('id', documentId)
        .single();

      if (error || !data) return null;
      
      return `${data.created_at}_${data.name}`;
    } catch (error) {
      console.error('Error getting document version:', error);
      return null;
    }
  }

  /**
   * Get worksheet version using HEAD request to edge function
   */
  private async getWorksheetVersion(worksheetId: string): Promise<{ version: string | null; etag?: string }> {
    try {
      // Get document info to create version
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('id', worksheetId)
        .single();

      if (error || !data) return { version: null };
      
      return {
        version: `${data.created_at}_${data.name}`,
        etag: undefined
      };
    } catch (error) {
      console.error('Error getting worksheet version:', error);
      return { version: null };
    }
  }

  /**
   * Invalidate cache across all layers with cascade support
   */
  async invalidateCache(event: CacheInvalidationEvent): Promise<void> {
    const { type, id, action, cascadeKeys = [] } = event;

    try {
      // Invalidate in all cache layers
      await Promise.all([
        // Enhanced cache - try multiple key patterns
        enhancedCache.delete(type, id),
        enhancedCache.delete(`enhanced-${type}`, id), // For compatibility with preloader
        
        // Intelligent cache  
        intelligentCache.invalidateWithDependencies(type, id),
        
        // Basic cache manager
        cacheManager.delete(type, id),
        
        // React Query cache with multiple patterns
        getQueryClient().invalidateQueries({ queryKey: [type, id] }),
        getQueryClient().invalidateQueries({ queryKey: [`enhanced-${type}`, id] }),
        
        // Clear version tracking
        cacheManager.delete('cache_meta', `${type}_${id}_version`)
      ]);

      // Handle cascade invalidation
      for (const cascadeKey of cascadeKeys) {
        await getQueryClient().invalidateQueries({ queryKey: [cascadeKey] });
      }

      // Special handling for cover images (clear in-memory cache too)
      if (type === 'cover') {
        this.clearInMemoryCoverCache(id);
      }

      // Emit cache invalidation event for components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cache-invalidated', {
          detail: { type, id, action }
        }));
      }

      console.log(`Cache invalidated for ${type}:${id} with action ${action}`);

    } catch (error) {
      console.error(`Error invalidating cache for ${type}:${id}:`, error);
    }
  }

  /**
   * Clear in-memory cover cache (from useCoverImage hook)
   */
  private clearInMemoryCoverCache(documentId: string) {
    // Access the global cover cache if available
    if (typeof window !== 'undefined' && (window as any).coverCache) {
      (window as any).coverCache.delete(documentId);
    }
  }

  /**
   * Validate all cached items on network return
   */
  async validateAllCachedItems(): Promise<void> {
    if (this.isValidating) return;
    
    this.isValidating = true;
    
    try {
      // Get all cached items that need validation
      const [coverEntries, documentEntries, worksheetEntries] = await Promise.all([
        cacheManager.getAll('covers'),
        cacheManager.getAll('metadata'), 
        cacheManager.getAll('folders')
      ]);

      const validationTasks = [
        ...coverEntries.map(entry => ({ type: 'cover' as const, id: (entry as any).id })),
        ...documentEntries.map(entry => ({ type: 'document' as const, id: (entry as any).id })),
        ...worksheetEntries.map(entry => ({ type: 'worksheet' as const, id: (entry as any).id }))
      ];

      // Process validation in batches based on network speed
      const batchSize = this.networkSpeed === 'fast' ? 10 : this.networkSpeed === 'medium' ? 5 : 2;
      
      for (let i = 0; i < validationTasks.length; i += batchSize) {
        const batch = validationTasks.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async ({ type, id }) => {
            const result = await this.validateCacheItem(type, id);
            
            if (result.hasServerChanges) {
              await this.invalidateCache({
                type,
                id,
                action: 'update',
                cascadeKeys: this.getCascadeKeys(type, id)
              });
            }
          })
        );

        // Add delay between batches for slow networks
        if (this.networkSpeed === 'slow' && i + batchSize < validationTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

    } catch (error) {
      console.error('Error during cache validation:', error);
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Get cascade keys for invalidation
   */
  private getCascadeKeys(type: string, id: string): string[] {
    switch (type) {
      case 'document':
        return [`worksheet_${id}`, `cover_${id}`, 'folders'];
      case 'worksheet':
        return [`document_${id}`];
      case 'cover':
        return [`document_${id}`];
      default:
        return [];
    }
  }

  /**
   * Store version information for cache item
   */
  async storeVersion(type: string, id: string, version: string, etag?: string): Promise<void> {
    try {
      await cacheManager.set('cache_meta', `${type}_${id}_version`, {
        version,
        etag,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error storing version for ${type}:${id}:`, error);
    }
  }

  /**
   * Get validation status
   */
  getValidationStatus() {
    return {
      isValidating: this.isValidating,
      queueSize: this.validationQueue.size,
      networkSpeed: this.networkSpeed
    };
  }
}

export const cacheCoordinator = new CacheCoordinator();