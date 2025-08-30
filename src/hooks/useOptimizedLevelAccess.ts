import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

interface LevelAccess {
  isActivated: boolean;
  activatedAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

const LEVEL_ACCESS_CACHE_KEY = 'levelAccessCache';

export const useOptimizedLevelAccess = (folderId: string | null) => {
  const { user } = useAuth();
  const [cachedData, setCachedData] = useState<LevelAccess | null>(null);

  // Load from localStorage immediately
  useEffect(() => {
    if (!user || !folderId) return;
    
    const cacheKey = `${LEVEL_ACCESS_CACHE_KEY}_${user.id}_${folderId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        // Use cache if less than 1 minute old
        if (age < 60 * 1000) {
          setCachedData(data);
        }
      } catch (error) {
        console.error('Failed to parse level access cache:', error);
      }
    }
  }, [user, folderId]);

  const query = useQuery({
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

      const result = {
        isActivated: expiresAt > now,
        activatedAt: data.activated_at,
        expiresAt: data.access_expires_at,
        daysRemaining: Math.max(0, daysRemaining)
      };

      // Cache the result
      const cacheKey = `${LEVEL_ACCESS_CACHE_KEY}_${user.id}_${folderId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }));

      return result;
    },
    enabled: !!user && !!folderId,
    staleTime: 30 * 1000, // 30 seconds - more aggressive caching
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Return cached data immediately if available, otherwise query data
  return {
    ...query,
    data: cachedData || query.data,
    isLoading: !cachedData && query.isLoading,
  };
};