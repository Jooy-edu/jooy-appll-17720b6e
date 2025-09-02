import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { documentStore } from '@/utils/documentStore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

export const useOfflineLevelActivation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const activateLevelMutation = useMutation({
    mutationFn: async ({ code, folderId }: { code: string; folderId: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Call the activation edge function
      const { data, error } = await supabase.functions.invoke('activate-level', {
        body: { code, folder_id: folderId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      // Cache the new activation immediately
      const activation = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        folder_id: variables.folderId,
        activated_at: new Date().toISOString(),
        access_expires_at: data.access_expires_at,
        access_duration_days: data.access_duration_days,
      };

      await documentStore.saveLevelActivations([activation]);

      // Invalidate related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['level-access'] });
      queryClient.invalidateQueries({ queryKey: ['user-level-activations'] });
      queryClient.invalidateQueries({ queryKey: ['user-activated-levels'] });

      toast({
        title: "Level Activated!",
        description: "You now have access to this level.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    activateLevel: activateLevelMutation.mutate,
    isLoading: activateLevelMutation.isPending,
    error: activateLevelMutation.error,
  };
};