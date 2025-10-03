import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import type { WorksheetMetadata } from '@/types/worksheet';

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string | null;
}

export const useOfflineWorksheetData = (worksheetId: string) => {
  return useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: async (): Promise<WorksheetDataResponse> => {
      // Try cache first (offline-first approach)
      try {
        const cachedData = await documentStore.getWorksheetData(worksheetId);
        if (cachedData) {
          // For auto mode, PDF might not exist - return null
          // For regions mode, generate PDF URL
          const pdfUrl = cachedData.mode === 'auto' 
            ? null 
            : `/pdfs/${worksheetId}.pdf`;
          return {
            meta: cachedData,
            pdfUrl
          };
        }
      } catch (error) {
        console.warn('Failed to get cached worksheet data:', error);
      }

      // Fallback to Supabase function when online or cache miss
      try {
        const { networkService } = await import('@/utils/networkService');
        const settings = networkService.getOptimalSettings();
        
        const response = await networkService.supabaseWithRetry('get-worksheet-data', 
          { worksheetId },
          {
            timeout: settings.timeout,
            retryConfig: settings.retryConfig,
            conditionalRequest: true,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch worksheet: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data?.meta) {
          throw new Error('Invalid response from worksheet data function: missing metadata');
        }

        // For regions mode, pdfUrl is required
        if (data.meta.mode !== 'auto' && !data?.pdfUrl) {
          throw new Error('Invalid response: PDF URL is required for regions mode');
        }

        // Cache the fetched data for future offline use
        try {
          await documentStore.saveWorksheetData(worksheetId, data.meta, Date.now());
        } catch (cacheError) {
          console.warn('Failed to cache worksheet data:', cacheError);
        }

        return {
          meta: data.meta,
          pdfUrl: data.pdfUrl
        };
      } catch (supabaseError) {
        // Check if user is offline
        if (!navigator.onLine) {
          throw new Error(`لا يمكن تحميل المستند "${worksheetId}" في وضع عدم الاتصال. يرجى الاتصال بالإنترنت أولاً لتحميل المحتوى.`);
        }
        throw new Error(`Document "${worksheetId}" not found. Please check if the QR code is valid or the document exists in the database.`);
      }
    },
    enabled: !!worksheetId,
    staleTime: 2 * 60 * 1000, // 2 minutes - standardized cache duration
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 or network is offline
      if (error.message.includes('404') || error.message.includes('Network unavailable')) {
        return false;
      }
      // Use exponential backoff for retries
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000)
  });
};

export const useOfflineRegionsByPage = (worksheetId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['regions', worksheetId, pageNumber],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('document_regions')
          .select('*')
          .eq('document_id', worksheetId)
          .eq('page', pageNumber)
          .order('created_at', { ascending: true });

        if (error) {
          throw new Error(`Failed to fetch regions: ${error.message}`);
        }

        return data || [];
      } catch (supabaseError) {
        console.log('Failed to fetch regions from Supabase:', supabaseError);
        return [];
      }
    },
    enabled: !!worksheetId && !!pageNumber,
    staleTime: 2 * 60 * 1000, // 2 minutes - standardized cache duration
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 or network is offline
      if (error.message.includes('404') || error.message.includes('Network unavailable')) {
        return false;
      }
      // Use exponential backoff for retries
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000)
  });
};