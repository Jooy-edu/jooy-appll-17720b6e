import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { WorksheetMetadata, RegionsModeMetadata } from '@/types/worksheet'
import { useEnhancedOfflineData } from './useEnhancedOfflineData'

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

interface WorksheetDataResult {
  data: WorksheetDataResponse | null;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

interface RegionData {
  id: string;
  document_id: string;
  page: number;
  created_at: string;
  description: string;
  height: number;
  name: string;
  type: string;
  user_id: string;
  width: number;
  x: number;
  y: number;
}

interface RegionsDataResult {
  data: RegionData[];
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

export const useWorksheetData = (worksheetId: string): WorksheetDataResult => {
  // Use enhanced offline data for worksheet fetching
  const result = useEnhancedOfflineData<WorksheetDataResponse>({
    queryKey: ['enhanced-worksheet', worksheetId],
    category: 'worksheets',
    queryFn: async (): Promise<WorksheetDataResponse> => {
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

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    isError: !!result.error,
    refetch: result.refetch
  };
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number): RegionsDataResult => {
  // Use enhanced offline data for regions fetching
  const result = useEnhancedOfflineData({
    queryKey: ['enhanced-regions', worksheetId, pageNumber.toString()],
    category: 'regions',
    queryFn: async () => {
      if (!worksheetId || pageNumber === undefined) {
        throw new Error('Worksheet ID and page number are required');
      }

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
    realtimeTable: 'document_regions',
    realtimeFilter: `document_id=eq.${worksheetId}`,
    dependencies: [`worksheet_${worksheetId}`],
  });

  return {
    data: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    isError: !!result.error,
    refetch: result.refetch
  };
}