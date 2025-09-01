import { useEnhancedOfflineData } from './useEnhancedOfflineData';
import { supabase } from '@/integrations/supabase/client';
import type { WorksheetMetadata } from '@/types/worksheet';

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useEnhancedWorksheetData = (worksheetId: string) => {
  return useEnhancedOfflineData<WorksheetDataResponse>({
    queryKey: ['enhanced-worksheet', worksheetId],
    category: 'worksheets',
    queryFn: async () => {
      if (!worksheetId) throw new Error('Worksheet ID is required');

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
    enabled: !!worksheetId,
    dependencies: [`documents_${worksheetId}`],
    staleTime: 5 * 60 * 1000, // 5 minutes - longer for worksheet data
    preloadRelated: false, // Worksheets are usually accessed individually
  });
};

export const useEnhancedRegionsByPage = (worksheetId: string, pageNumber: number) => {
  return useEnhancedOfflineData({
    queryKey: ['enhanced-regions', worksheetId, pageNumber.toString()],
    category: 'regions',
    queryFn: async () => {
      if (!worksheetId || !pageNumber) return [];

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
    enabled: !!worksheetId && !!pageNumber,
    dependencies: [`worksheets_${worksheetId}`],
    staleTime: 2 * 60 * 1000, // 2 minutes for regions
    realtimeTable: 'document_regions',
    realtimeFilter: `document_id=eq.${worksheetId}`,
  });
};