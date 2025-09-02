import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { backgroundSyncService } from '@/utils/backgroundSyncService';

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

      try {
        // First try to get from cache (offline support)
        const cachedActivation = await documentStore.getLevelActivation(folderId);
        if (cachedActivation) {
          const activation = cachedActivation.data;
          const expiresAt = new Date(activation.access_expires_at);
          const now = new Date();
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Trigger background sync if online
          if (!backgroundSyncService.isOffline()) {
            backgroundSyncService.syncLevelActivations?.();
          }

          return {
            isActivated: expiresAt > now,
            activatedAt: activation.activated_at,
            expiresAt: activation.access_expires_at,
            daysRemaining: Math.max(0, daysRemaining)
          };
        }

        // If not in cache and online, fetch from Supabase
        if (!backgroundSyncService.isOffline()) {
          const { data, error } = await supabase
            .from('user_level_activations')
            .select('activated_at, access_expires_at')
            .eq('user_id', user.id)
            .eq('folder_id', folderId)
            .single();

          if (error || !data) {
            return { isActivated: false };
          }

          // Cache the result
          await documentStore.saveLevelActivations([{
            folder_id: folderId,
            user_id: user.id,
            activated_at: data.activated_at,
            access_expires_at: data.access_expires_at
          }]);

          const expiresAt = new Date(data.access_expires_at);
          const now = new Date();
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          return {
            isActivated: expiresAt > now,
            activatedAt: data.activated_at,
            expiresAt: data.access_expires_at,
            daysRemaining: Math.max(0, daysRemaining)
          };
        }

        // Offline and no cache - return false
        return { isActivated: false };
      } catch (error) {
        console.error('Error checking level access:', error);
        return { isActivated: false };
      }
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

      try {
        // First try cache
        const cachedActivations = await documentStore.getLevelActivations();
        if (cachedActivations.length > 0) {
          // Trigger background sync if online
          if (!backgroundSyncService.isOffline()) {
            backgroundSyncService.syncLevelActivations?.();
          }
          return cachedActivations.map(cached => cached.data);
        }

        // If not in cache and online, fetch from Supabase
        if (!backgroundSyncService.isOffline()) {
          const { data, error } = await supabase
            .from('user_level_activations')
            .select(`
              *,
              folders(id, name)
            `)
            .eq('user_id', user.id)
            .order('activated_at', { ascending: false });

          if (error) throw error;
          
          // Cache the results
          if (data && data.length > 0) {
            await documentStore.saveLevelActivations(data);
          }
          
          return data || [];
        }

        return [];
      } catch (error) {
        console.error('Error fetching user level activations:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};