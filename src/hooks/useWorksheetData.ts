import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { WorksheetMetadata, RegionsModeMetadata } from '@/types/worksheet'
import { useEnhancedOfflineData } from './useEnhancedOfflineData'

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useWorksheetData = (worksheetId: string) => {
  // Use enhanced offline data for worksheet fetching
  return useEnhancedOfflineData({
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
        pdfUrl: data.pdfUrl,
      };
    },
    realtimeTable: 'documents',
    dependencies: [`document_${worksheetId}`],
  });
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number) => {
  // Use enhanced offline data for regions fetching
  return useEnhancedOfflineData({
    queryKey: ['enhanced-regions', worksheetId, pageNumber],
    category: 'regions',
    queryFn: async () => {
      if (!worksheetId || pageNumber === undefined) {
        throw new Error('Worksheet ID and page number are required');
      }

      const { data, error } = await supabase
        .from('document_regions')
        .select('*')
        .eq('document_id', worksheetId)
        .eq('page_number', pageNumber)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch regions: ${error.message}`);
      }

      return data || [];
    },
    realtimeTable: 'document_regions',
    realtimeFilter: `document_id=eq.${worksheetId}`,
    dependencies: [`worksheet_${worksheetId}`],
  });
}