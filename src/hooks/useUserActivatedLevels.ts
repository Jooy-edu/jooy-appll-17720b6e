import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUserActivatedLevels = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-activated-levels', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('user_level_activations')
        .select('folder_id')
        .eq('user_id', user.id)
        .gt('access_expires_at', new Date().toISOString());

      if (error) {
        throw error;
      }

      return data?.map(activation => activation.folder_id) || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};