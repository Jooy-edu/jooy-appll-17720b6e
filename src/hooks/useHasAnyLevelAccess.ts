import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LevelAccessData {
  hasAnyAccess: boolean;
  activeLevelsCount: number;
}

export const useHasAnyLevelAccess = () => {
  const { user } = useAuth();
  
  console.log('useHasAnyLevelAccess: Hook called with user:', user?.id);

  return useQuery({
    queryKey: ['has-any-level-access', user?.id],
    queryFn: async (): Promise<LevelAccessData> => {
      console.log('useHasAnyLevelAccess: Query function executing for user:', user?.id);
      
      if (!user) {
        console.log('useHasAnyLevelAccess: No user, returning false');
        return { hasAnyAccess: false, activeLevelsCount: 0 };
      }

      // Check if user has any level access
      const { data: hasAccess, error: accessError } = await supabase
        .rpc('user_has_any_level_access', { user_id_param: user.id });

      if (accessError) {
        throw accessError;
      }

      // Get count of active levels
      const { data: levelCount, error: countError } = await supabase
        .rpc('get_user_active_level_count', { user_id_param: user.id });

      if (countError) {
        throw countError;
      }

      return {
        hasAnyAccess: hasAccess || false,
        activeLevelsCount: levelCount || 0
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};