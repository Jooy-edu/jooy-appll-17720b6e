import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { WorksheetMetadata, RegionsModeMetadata } from '@/types/worksheet'
import { useOfflineWorksheetData, useOfflineRegionsByPage } from './useOfflineWorksheetData'

interface WorksheetDataResponse {
  meta: WorksheetMetadata;
  pdfUrl: string;
}

export const useWorksheetData = (worksheetId: string) => {
  // Use the new offline-first hook
  return useOfflineWorksheetData(worksheetId);
}

export const useRegionsByPage = (worksheetId: string, pageNumber: number) => {
  // Use the new offline-first hook
  return useOfflineRegionsByPage(worksheetId, pageNumber);
}