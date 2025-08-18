import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { WorksheetMetadata, RegionsModeMetadata } from '@/types/worksheet'

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useWorksheetData = (worksheetId: string) => {
  return useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: async (): Promise<WorksheetDataResponse> => {
      // Try to get worksheet data from Supabase first
      try {
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
        }
      } catch (supabaseError) {
        // No more local fallback - all data must come from Supabase
        throw new Error(`Document "${worksheetId}" not found. Please check if the QR code is valid or the document exists in the database.`)
      }
    },
    enabled: !!worksheetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a 404
      if (error.message.includes('404')) {
        return false
      }
      return failureCount < 3
    }
  })
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['regions', worksheetId, pageNumber],
    queryFn: async () => {
      try {
        // Try to get regions from document_regions table
        const { data, error } = await supabase
          .from('document_regions')
          .select('*')
          .eq('document_id', worksheetId)
          .eq('page', pageNumber)
          .order('created_at', { ascending: true })

        if (error) {
          throw new Error(`Failed to fetch regions: ${error.message}`)
        }

        return data || []
      } catch (supabaseError) {
        // No more local fallback - all data must come from Supabase
        console.log('Failed to fetch regions from Supabase:', supabaseError)
        return []
      }
    },
    enabled: !!worksheetId && !!pageNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}