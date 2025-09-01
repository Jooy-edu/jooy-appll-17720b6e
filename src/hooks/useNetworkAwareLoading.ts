import { useState, useEffect, useCallback } from 'react';
import { enhancedCache } from '@/utils/enhancedCacheManager';

interface NetworkInfo {
  speed: 'slow' | 'medium' | 'fast';
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface LoadingStrategy {
  batchSize: number;
  delay: number;
  enableOptimizations: boolean;
  quality: 'low' | 'medium' | 'high';
}

export const useNetworkAwareLoading = () => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    speed: 'medium',
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  });

  const [loadingStrategy, setLoadingStrategy] = useState<LoadingStrategy>({
    batchSize: 5,
    delay: 100,
    enableOptimizations: true,
    quality: 'high'
  });

  // Monitor network changes
  useEffect(() => {
    const updateNetworkInfo = () => {
      try {
        const connection = (navigator as any).connection;
        if (connection) {
          const speed = enhancedCache.getNetworkSpeed();
          
          setNetworkInfo({
            speed,
            effectiveType: connection.effectiveType || '4g',
            downlink: connection.downlink || 10,
            rtt: connection.rtt || 100,
            saveData: connection.saveData || false
          });

          // Update loading strategy based on network conditions
          updateLoadingStrategy(speed, connection.saveData, connection.rtt);
        }
      } catch (error) {
        console.warn('Network monitoring not supported');
      }
    };

    const updateLoadingStrategy = (speed: string, saveData: boolean, rtt: number) => {
      let strategy: LoadingStrategy;

      if (speed === 'slow' || saveData || rtt > 300) {
        // Slow network or save data mode
        strategy = {
          batchSize: 2,
          delay: 500,
          enableOptimizations: true,
          quality: 'low'
        };
      } else if (speed === 'medium') {
        // Medium network
        strategy = {
          batchSize: 5,
          delay: 200,
          enableOptimizations: true,
          quality: 'medium'
        };
      } else {
        // Fast network
        strategy = {
          batchSize: 10,
          delay: 50,
          enableOptimizations: false,
          quality: 'high'
        };
      }

      setLoadingStrategy(strategy);
    };

    // Initial update
    updateNetworkInfo();

    // Listen for network changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection?.addEventListener?.('change', updateNetworkInfo);
      
      return () => {
        connection?.removeEventListener?.('change', updateNetworkInfo);
      };
    }
  }, []);

  // Batch loading function with network awareness
  const batchLoad = useCallback(async <T>(
    items: any[],
    loadFn: (item: any) => Promise<T>,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<T[]> => {
    const results: T[] = [];
    const { batchSize, delay } = loadingStrategy;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.allSettled(
          batch.map(item => loadFn(item))
        );
        
        // Extract successful results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results[i + index] = result.value;
          }
        });
        
        onProgress?.(Math.min(i + batchSize, items.length), items.length);
        
        // Add delay between batches for slow networks
        if (i + batchSize < items.length && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('Batch loading error:', error);
      }
    }
    
    return results;
  }, [loadingStrategy]);

  // Progressive image loading
  const loadImageProgressively = useCallback(async (
    src: string,
    placeholderSrc?: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // For slow networks or save data mode, return placeholder immediately
      if ((networkInfo.speed === 'slow' || networkInfo.saveData) && placeholderSrc) {
        resolve(placeholderSrc);
        return;
      }
      
      img.onload = () => resolve(src);
      img.onerror = () => {
        // Fallback to placeholder on error
        if (placeholderSrc) {
          resolve(placeholderSrc);
        } else {
          reject(new Error('Image load failed'));
        }
      };
      
      img.src = src;
    });
  }, [networkInfo]);

  // Adaptive timeout based on network conditions
  const getAdaptiveTimeout = useCallback((): number => {
    switch (networkInfo.speed) {
      case 'slow': return 30000; // 30 seconds
      case 'medium': return 15000; // 15 seconds
      case 'fast': return 8000; // 8 seconds
      default: return 15000;
    }
  }, [networkInfo.speed]);

  // Check if should use optimizations
  const shouldOptimize = useCallback((): boolean => {
    return loadingStrategy.enableOptimizations || 
           networkInfo.saveData || 
           networkInfo.speed === 'slow';
  }, [loadingStrategy.enableOptimizations, networkInfo.saveData, networkInfo.speed]);

  // Get recommended image quality
  const getImageQuality = useCallback((): 'low' | 'medium' | 'high' => {
    if (networkInfo.saveData) return 'low';
    return loadingStrategy.quality;
  }, [networkInfo.saveData, loadingStrategy.quality]);

  // Preload critical resources based on network
  const preloadCriticalResources = useCallback(async (
    resources: string[]
  ): Promise<void> => {
    if (!shouldOptimize() && resources.length > 0) {
      // On fast networks, preload more aggressively
      const { batchSize } = loadingStrategy;
      await batchLoad(
        resources.slice(0, batchSize * 2),
        async (url: string) => {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.href = url;
          link.as = url.includes('.mp3') ? 'audio' : 'image';
          document.head.appendChild(link);
          return url;
        }
      );
    }
  }, [shouldOptimize, loadingStrategy, batchLoad]);

  return {
    networkInfo,
    loadingStrategy,
    batchLoad,
    loadImageProgressively,
    getAdaptiveTimeout,
    shouldOptimize,
    getImageQuality,
    preloadCriticalResources,
    
    // Utility methods
    isSlowNetwork: networkInfo.speed === 'slow' || networkInfo.saveData,
    isFastNetwork: networkInfo.speed === 'fast' && !networkInfo.saveData,
    shouldReduceAnimations: shouldOptimize(),
    shouldUseLowQuality: networkInfo.saveData || networkInfo.speed === 'slow',
  };
};

// Hook for managing progressive data loading
export const useProgressiveDataLoading = <T>() => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedItems, setLoadedItems] = useState<T[]>([]);
  
  const { batchLoad, loadingStrategy } = useNetworkAwareLoading();

  const loadData = useCallback(async (
    items: any[],
    loadFn: (item: any) => Promise<T>
  ): Promise<T[]> => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadedItems([]);

    try {
      const results = await batchLoad(
        items,
        loadFn,
        (loaded, total) => {
          setLoadingProgress((loaded / total) * 100);
          // Update loaded items progressively
          setLoadedItems(prev => {
            const newItems = [...prev];
            // This is a simplified approach - in practice you'd want to handle this more carefully
            return newItems;
          });
        }
      );

      setLoadedItems(results.filter(Boolean));
      return results;
    } finally {
      setIsLoading(false);
      setLoadingProgress(100);
    }
  }, [batchLoad]);

  return {
    loadData,
    loadingProgress,
    isLoading,
    loadedItems,
    batchSize: loadingStrategy.batchSize,
    clearLoadedItems: () => setLoadedItems([]),
  };
};