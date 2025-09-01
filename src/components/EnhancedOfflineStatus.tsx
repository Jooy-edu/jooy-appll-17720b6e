import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { useNetworkAwareLoading } from '@/hooks/useNetworkAwareLoading';
import { 
  Wifi, 
  WifiOff, 
  Download, 
  Upload, 
  CheckCircle, 
  Zap,
  HardDrive,
  RefreshCw,
  TrendingUp,
  Database
} from 'lucide-react';

export const EnhancedOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [autoHide, setAutoHide] = useState(true);
  
  const { networkInfo, loadingStrategy } = useNetworkAwareLoading();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache statistics periodically
  useEffect(() => {
    const loadCacheStats = async () => {
      try {
        const stats = await enhancedCache.getCacheStats();
        setCacheStats(stats);
      } catch (error) {
        console.error('Failed to load cache stats:', error);
      }
    };

    loadCacheStats();
    const interval = setInterval(loadCacheStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-hide logic
  useEffect(() => {
    if (isOnline && autoHide) {
      const timer = setTimeout(() => setShowDetails(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, autoHide]);

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const getStatusMessage = () => {
    if (!isOnline) {
      const totalCached = cacheStats?.totalEntries || 0;
      return `Working offline - ${totalCached} items cached`;
    }
    return 'Online - Enhanced caching active';
  };

  const getNetworkSpeedColor = () => {
    switch (networkInfo.speed) {
      case 'fast': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'slow': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const clearCache = async () => {
    try {
      await Promise.all([
        enhancedCache.clearCategory('folders'),
        enhancedCache.clearCategory('documents'),
        enhancedCache.clearCategory('worksheets')
      ]);
      
      // Reload stats
      const stats = await enhancedCache.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  // Don't show if everything is perfect and auto-hide is on
  if (!showDetails && isOnline && autoHide) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowDetails(true)}
          className="opacity-50 hover:opacity-100"
        >
          {getStatusIcon()}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Card className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <CardTitle className="text-sm">{getStatusMessage()}</CardTitle>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Network speed indicator */}
              <Badge 
                variant="outline" 
                className={`text-xs ${getNetworkSpeedColor()}`}
              >
                <Zap className="h-3 w-3 mr-1" />
                {networkInfo.speed}
              </Badge>

              {/* Actions */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs px-2 py-1"
              >
                {showDetails ? '−' : '+'}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAutoHide(!autoHide)}
                className="text-xs px-1 py-1"
              >
                {autoHide ? '📌' : '🔓'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {showDetails && (
          <CardContent className="pt-0 space-y-4">
            {/* Network Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <Wifi className="h-3 w-3 mr-1" />
                  Network: {networkInfo.effectiveType}
                </span>
                <span className="text-muted-foreground">
                  {networkInfo.downlink}Mbps
                </span>
              </div>
              
              {networkInfo.saveData && (
                <Badge variant="outline" className="text-xs">
                  Data Saver Active
                </Badge>
              )}
            </div>

            {/* Loading Strategy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Strategy
                </span>
                <span className="text-muted-foreground">
                  Batch: {loadingStrategy.batchSize}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                Quality: {loadingStrategy.quality}
              </Badge>
            </div>

            {/* Cache Statistics */}
            {cacheStats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <Database className="h-3 w-3 mr-1" />
                    Cache: {cacheStats.totalEntries} items
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearCache}
                    className="text-xs px-2 py-1"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>

                {/* Cache breakdown */}
                <div className="space-y-1 text-xs">
                  {Object.entries(cacheStats.categoryCounts).map(([category, count]) => (
                    <div key={category} className="flex justify-between">
                      <span className="capitalize">{category}:</span>
                      <span>{String(count)}</span>
                    </div>
                  ))}
                </div>

                {/* Storage usage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center">
                      <HardDrive className="h-3 w-3 mr-1" />
                      Storage: {Math.round(cacheStats.storageUsage.used / 1024 / 1024)}MB
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(cacheStats.storageUsage.ratio * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={cacheStats.storageUsage.ratio * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            )}

            {/* Offline specific information */}
            {!isOnline && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertDescription className="text-sm">
                  You're working offline. Changes will sync when connected.
                </AlertDescription>
              </Alert>
            )}

            {/* Performance optimizations indicator */}
            {loadingStrategy.enableOptimizations && (
              <div className="text-xs text-muted-foreground">
                ⚡ Performance optimizations active
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};