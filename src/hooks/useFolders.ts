import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useFolders = () => {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};