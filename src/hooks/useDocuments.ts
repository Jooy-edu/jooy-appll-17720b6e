import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineDocuments } from './useOfflineDocuments';

export const useDocuments = (folderId?: string) => {
  // Use the new offline-first hook
  return useOfflineDocuments(folderId);
};