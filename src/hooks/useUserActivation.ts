import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserActivationData {
  isActivated: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  accessDurationDays: number | null;
}

export const useUserActivation = () => {
  const { user } = useAuth();
  const [activationData, setActivationData] = useState<UserActivationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivationData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_activations')
          .select(`
            activated_at,
            app_access_expires_at,
            activation_codes!inner(app_access_duration_days)
          `)
          .eq('user_id', user.id)
          .order('activated_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          const expiresAt = new Date(data.app_access_expires_at);
          const now = new Date();
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          setActivationData({
            isActivated: true,
            activatedAt: data.activated_at,
            expiresAt: data.app_access_expires_at,
            daysRemaining: Math.max(0, daysRemaining),
            accessDurationDays: data.activation_codes.app_access_duration_days
          });
        } else {
          setActivationData({
            isActivated: false,
            activatedAt: null,
            expiresAt: null,
            daysRemaining: null,
            accessDurationDays: null
          });
        }
      } catch (err) {
        console.error('Error fetching activation data:', err);
        setError('Failed to load activation data');
      } finally {
        setLoading(false);
      }
    };

    fetchActivationData();
  }, [user]);

  return { activationData, loading, error };
};