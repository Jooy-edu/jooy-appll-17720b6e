import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useDocuments = (folderId?: string) => {
  return useQuery({
    queryKey: ['documents', folderId],
    queryFn: async () => {
      // Get current user first
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId!)
        .order('name');
      
      if (error) throw error;
      
      // Filter to show user's own documents OR public documents
      const filteredData = data?.filter(doc => 
        doc.user_id === user.user?.id || !doc.is_private
      ) || [];
      
      return filteredData;
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};