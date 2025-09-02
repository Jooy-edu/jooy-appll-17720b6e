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
      console.log(`Loading worksheet data for: ${worksheetId}`);
      
      // Try cache first (offline-first approach)
      let cachedData = null;
      try {
        cachedData = await documentStore.getWorksheetData(worksheetId);
        if (cachedData) {
          console.log(`Found cached worksheet data for: ${worksheetId}`);
          // Generate PDF URL for cached data
          const pdfUrl = `/pdfs/${worksheetId}.pdf`;
          return {
            meta: cachedData,
            pdfUrl
          };
        }
      } catch (error) {
        console.warn('Failed to get cached worksheet data:', error);
      }

      // Check if we're offline - if so, and we have no cached data, provide better error
      if (!navigator.onLine && !cachedData) {
        throw new Error(`Worksheet "${worksheetId}" is not available offline. Please connect to the internet to download this content first.`);
      }

      // Fallback to Supabase function when online or cache miss
      try {
        console.log(`Fetching worksheet data from server for: ${worksheetId}`);
        const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
          body: { worksheetId },
        });

        if (error) {
          throw new Error(`Failed to fetch worksheet: ${error.message}`);
        }

        if (!data?.meta || !data?.pdfUrl) {
          throw new Error('Invalid response from worksheet data function');
        }

        // Cache the fetched data for future offline use
        try {
          await documentStore.saveWorksheetData(worksheetId, data.meta, Date.now());
          console.log(`Cached worksheet data for future offline use: ${worksheetId}`);
        } catch (cacheError) {
          console.warn('Failed to cache worksheet data:', cacheError);
        }

        return {
          meta: data.meta,
          pdfUrl: data.pdfUrl
        };
      } catch (supabaseError) {
        // If we had cached data but Supabase call failed (offline scenario), return cached data
        if (cachedData) {
          console.log(`Supabase call failed, using cached data for: ${worksheetId}`);
          const pdfUrl = `/pdfs/${worksheetId}.pdf`;
          return {
            meta: cachedData,
            pdfUrl
          };
        }
        
        throw new Error(`Document "${worksheetId}" not found. Please check if the QR code is valid or the document exists in the database.`);
      }
    },
    enabled: !!worksheetId,
    staleTime: 30 * 60 * 1000, // 30 minutes - worksheets change less frequently
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 or offline-specific error
      if (error.message.includes('404') || error.message.includes('not available offline')) {
        return false;
      }
      return failureCount < 2; // Reduce retry attempts
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