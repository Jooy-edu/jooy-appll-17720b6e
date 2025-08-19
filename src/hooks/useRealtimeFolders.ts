import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeFolders = () => {
  const query = useQuery({
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
      
      // Filter folders: only user's own folders
      const filteredData = data?.filter(folder => 
        folder.user_id === user.user?.id
      ) || [];
      
      return filteredData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Set up real-time subscription for folders
  useEffect(() => {
    const channel = supabase
      .channel('folders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'folders'
        },
        () => {
          // Invalidate and refetch folders when any change happens
          query.refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        () => {
          // Also invalidate when documents change (affects folder visibility)
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query]);

  return query;
};