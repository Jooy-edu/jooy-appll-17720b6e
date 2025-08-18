import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useDocuments = (folderId?: string) => {
  return useQuery({
    queryKey: ['documents', folderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId!)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};