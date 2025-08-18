import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeDocuments = (folderId?: string) => {
  const query = useQuery({
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

  // Set up real-time subscription for documents
  useEffect(() => {
    if (!folderId) return;

    const channel = supabase
      .channel(`documents-realtime-${folderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `folder_id=eq.${folderId}`
        },
        () => {
          // Invalidate and refetch documents when any change happens
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [folderId, query]);

  return query;
};