import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import type { WorksheetMetadata } from '@/types/worksheet';

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useOfflineWorksheetData = (worksheetId: string) => {
  return useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: async (): Promise<WorksheetDataResponse> => {
      console.log(`[useOfflineWorksheetData] Fetching worksheet data for: ${worksheetId}`);
      
      try {
        // Try to fetch from server first (online-first approach)
        console.log(`[useOfflineWorksheetData] Attempting to fetch from server...`);
        const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
          body: { worksheetId },
        });

        if (error) {
          console.error(`[useOfflineWorksheetData] Server error:`, error);
          throw new Error(error.message);
        }

        if (data?.meta && data?.pdfUrl) {
          console.log(`[useOfflineWorksheetData] Server data received, caching for offline use`);
          // Cache the data for offline use when successfully fetched online
          try {
            await documentStore.saveWorksheetData(worksheetId, data.meta, Date.now());
          } catch (cacheError) {
            console.warn('Failed to cache worksheet data:', cacheError);
          }
          
          return {
            meta: data.meta,
            pdfUrl: data.pdfUrl
          };
        }
        
        throw new Error('Invalid response from server');
      } catch (error) {
        console.warn(`[useOfflineWorksheetData] Server fetch failed, trying offline cache...`, error);
        
        // Try to get cached data only if server fetch failed
        try {
          const cachedData = await documentStore.getWorksheetData(worksheetId);
          if (cachedData) {
            console.log(`[useOfflineWorksheetData] Using cached data for offline access`);
            const pdfUrl = `/pdfs/${worksheetId}.pdf`;
            return {
              meta: cachedData,
              pdfUrl
            };
          }
        } catch (cacheError) {
          console.warn('Failed to get cached worksheet data:', cacheError);
        }
        
        // No cached data available
        console.error(`[useOfflineWorksheetData] No cached data available for worksheet: ${worksheetId}`);
        throw new Error('ورقة عمل غير موجودة - يجب الاتصال بالإنترنت لتحميل المحتوى أولاً');
      }
    },
    enabled: !!worksheetId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a "not found" error
      if (error.message.includes('ورقة عمل غير موجودة') || error.message.includes('404')) {
        return false;
      }
      return failureCount < 2;
    }
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
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};