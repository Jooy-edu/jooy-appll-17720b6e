interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  conditionalRequest?: boolean;
}

class NetworkService {
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2,
  };

  private requestCache = new Map<string, { etag: string; lastModified: string }>();

  async fetchWithRetry(url: string, options: RequestOptions = {}): Promise<Response> {
    const {
      timeout = 10000,
      retryConfig = {},
      conditionalRequest = false,
      ...fetchOptions
    } = options;

    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | null = null;

    // Add conditional request headers if enabled
    if (conditionalRequest && this.requestCache.has(url)) {
      const cached = this.requestCache.get(url)!;
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'If-None-Match': cached.etag,
        'If-Modified-Since': cached.lastModified,
      };
    }

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Cache response headers for conditional requests
        if (conditionalRequest && response.ok) {
          const etag = response.headers.get('etag');
          const lastModified = response.headers.get('last-modified');
          if (etag || lastModified) {
            this.requestCache.set(url, {
              etag: etag || '',
              lastModified: lastModified || '',
            });
          }
        }

        // Don't retry on 4xx errors (except 429 Too Many Requests)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Return successful responses
        if (response.ok || response.status === 304) {
          return response;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort or network errors that indicate permanent failure
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }
          if (error.message.includes('Failed to fetch') && !navigator.onLine) {
            throw new Error('Network unavailable');
          }
        }

        // Don't retry on last attempt
        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt),
          config.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay * (0.5 + Math.random() * 0.5);

        console.warn(`Request failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${Math.round(jitteredDelay)}ms:`, error);

        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  async supabaseWithRetry(functionName: string, body: any, options: RequestOptions = {}) {
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      
      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }
      
      // Create a mock response that matches fetch Response interface
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => data,
        headers: new Headers(),
      };
      
      return response as Response;
    } catch (error) {
      // Fallback to retry logic if the direct invoke fails
      throw error;
    }
  }

  // Connection quality detection
  getConnectionQuality(): 'slow' | 'fast' | 'unknown' {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          return 'slow';
        }
        if (effectiveType === '3g' || effectiveType === '4g') {
          return 'fast';
        }
      }
    }
    return 'unknown';
  }

  // Progressive enhancement based on connection
  getOptimalSettings() {
    const quality = this.getConnectionQuality();
    
    switch (quality) {
      case 'slow':
        return {
          timeout: 30000,
          retryConfig: { maxRetries: 1, baseDelay: 2000 },
          batchSize: 1,
          enablePreloading: false,
        };
      case 'fast':
        return {
          timeout: 5000,
          retryConfig: { maxRetries: 3, baseDelay: 500 },
          batchSize: 5,
          enablePreloading: true,
        };
      default:
        return {
          timeout: 10000,
          retryConfig: { maxRetries: 2, baseDelay: 1000 },
          batchSize: 3,
          enablePreloading: true,
        };
    }
  }
}

export const networkService = new NetworkService();