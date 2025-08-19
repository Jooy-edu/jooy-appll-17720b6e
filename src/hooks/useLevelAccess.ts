import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LevelAccess {
  isActivated: boolean;
  activatedAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

export const useLevelAccess = (folderId: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['level-access', user?.id, folderId],
    queryFn: async (): Promise<LevelAccess> => {
      if (!user || !folderId) {
        return { isActivated: false };
      }

      const { data, error } = await supabase
        .from('user_level_activations')
        .select('activated_at, access_expires_at')
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
        .single();

      if (error || !data) {
        return { isActivated: false };
      }

      const expiresAt = new Date(data.access_expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isActivated: expiresAt > now,
        activatedAt: data.activated_at,
        expiresAt: data.access_expires_at,
        daysRemaining: Math.max(0, daysRemaining)
      };
    },
    enabled: !!user && !!folderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUserLevelActivations = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-level-activations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_level_activations')
        .select(`
          *,
          folders(id, name)
        `)
        .eq('user_id', user.id)
        .order('activated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};