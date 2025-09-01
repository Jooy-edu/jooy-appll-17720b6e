import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { WorksheetMetadata, RegionsModeMetadata } from '@/types/worksheet'
import { useEnhancedWorksheetData, useEnhancedRegionsByPage } from './useEnhancedWorksheetData'

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useWorksheetData = (worksheetId: string) => {
  // Use enhanced worksheet data with offline-first caching
  const enhancedResult = useEnhancedWorksheetData(worksheetId);
  
  // Fallback to traditional query if enhanced version fails
  const fallbackResult = useQuery({
    queryKey: ['worksheet-fallback', worksheetId],
    queryFn: async (): Promise<WorksheetDataResponse> => {
      const { data, error } = await supabase.functions.invoke('get-worksheet-data', {
        body: { worksheetId },
      });

      if (error) {
        throw new Error(`Failed to fetch worksheet: ${error.message}`)
      }

      if (!data?.meta || !data?.pdfUrl) {
        throw new Error('Invalid response from worksheet data function')
      }

      return {
        meta: data.meta,
        pdfUrl: data.pdfUrl
      };
    },
    enabled: !!worksheetId && enhancedResult.isError && !enhancedResult.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error.message.includes('404')) {
        return false
      }
      return failureCount < 3
    }
  });

  // Return enhanced result if available, otherwise fallback
  if (enhancedResult.data || enhancedResult.isLoading || !enhancedResult.isError) {
    return {
      ...enhancedResult,
      data: enhancedResult.data,
      isLoading: enhancedResult.isLoading,
      error: enhancedResult.error,
      isError: enhancedResult.isError
    };
  }

  return fallbackResult;
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number) => {
  // Use enhanced regions data with offline-first caching
  const enhancedResult = useEnhancedRegionsByPage(worksheetId, pageNumber);
  
  // Fallback to traditional query if enhanced version fails
  const fallbackResult = useQuery({
    queryKey: ['regions-fallback', worksheetId, pageNumber],
    queryFn: async () => {
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
    },
    enabled: !!worksheetId && !!pageNumber && enhancedResult.isError && !enhancedResult.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Return enhanced result if available, otherwise fallback
  if (enhancedResult.data || enhancedResult.isLoading || !enhancedResult.isError) {
    return {
      ...enhancedResult,
      data: enhancedResult.data || [],
      isLoading: enhancedResult.isLoading,
      error: enhancedResult.error,
      isError: enhancedResult.isError
    };
  }

  return fallbackResult;
}