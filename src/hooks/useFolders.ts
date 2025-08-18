import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useFolders = () => {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      // Get current user first
      const { data: user } = await supabase.auth.getUser();
      
      // Fetch all folders with their documents
      const { data, error } = await supabase
        .from('folders')
        .select(`
          *,
          documents(id, is_private, user_id)
        `)
        .order('name');
      
      if (error) throw error;
      
      // Filter folders: user's own folders OR folders with public documents
      const filteredData = data?.filter(folder => 
        folder.user_id === user.user?.id ||
        folder.documents?.some((doc: any) => !doc.is_private)
      ) || [];
      
      return filteredData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};