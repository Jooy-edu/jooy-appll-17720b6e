import { supabase } from '@/integrations/supabase/client';
import { documentStore } from './documentStore';

export interface OfflineUser {
  id: string;
  email: string | null;
  user_metadata?: any;
}

/**
 * Get user data with offline fallback
 * First tries to get from Supabase (online), then falls back to cached data (offline)
 */
export const getOfflineUser = async (): Promise<{ user: OfflineUser | null; error: Error | null }> => {
  try {
    // First try to get from Supabase (online)
    const { data, error } = await supabase.auth.getUser();
    
    if (!error && data.user) {
      // Save to cache for offline use
      await documentStore.saveUserSession(data.user);
      return { 
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata
        }, 
        error: null 
      };
    }
    
    // If online request failed, try cached data
    const cachedUser = await documentStore.getCachedUser();
    if (cachedUser) {
      return { 
        user: {
          id: cachedUser.id,
          email: cachedUser.email,
          user_metadata: cachedUser.user_metadata
        }, 
        error: null 
      };
    }
    
    // No user found online or offline
    return { user: null, error: error || new Error('No user found') };
    
  } catch (error) {
    // Network error - try cached data as fallback
    try {
      const cachedUser = await documentStore.getCachedUser();
      if (cachedUser) {
        return { 
          user: {
            id: cachedUser.id,
            email: cachedUser.email,
            user_metadata: cachedUser.user_metadata
          }, 
          error: null 
        };
      }
    } catch (cacheError) {
      console.error('Failed to get cached user:', cacheError);
    }
    
    return { user: null, error: error as Error };
  }
};

/**
 * Clear cached user session (call on sign out)
 */
export const clearOfflineUserSession = async (): Promise<void> => {
  await documentStore.clearUserSession();
};