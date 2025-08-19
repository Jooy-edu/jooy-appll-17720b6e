import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LevelActivationResult {
  success: boolean;
  expiresAt?: string;
  error?: string;
}

export const useLevelActivation = () => {
  const { user, refreshProfile } = useAuth();
  const [isActivating, setIsActivating] = useState(false);

  const validateCodeFormat = (code: string): boolean => {
    const cleanCode = code.replace(/[-\s]/g, '');
    return /^[A-Z0-9]{16}$/.test(cleanCode);
  };

  const formatCode = (input: string): string => {
    const cleanInput = input.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const formatted = cleanInput.replace(/(.{4})/g, '$1-').slice(0, 19);
    return formatted;
  };

  const activateLevel = async (activationCode: string, folderId: string): Promise<LevelActivationResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    setIsActivating(true);

    try {
      const cleanCode = activationCode.replace(/[-\s]/g, '');

      if (!validateCodeFormat(cleanCode)) {
        return { success: false, error: 'Invalid activation code format' };
      }

      // Check if code exists and is valid
      const { data: codeData, error: codeError } = await supabase
        .from('activation_codes')
        .select('id, is_active, expires_at, max_uses, app_access_duration_days')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (codeError || !codeData) {
        return { success: false, error: 'Invalid or expired activation code' };
      }

      // Check if code has expired
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        return { success: false, error: 'Activation code has expired' };
      }

      // Check if user already activated this level
      const { data: existingActivation } = await supabase
        .from('user_level_activations')
        .select('id')
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
        .maybeSingle();

      if (existingActivation) {
        return { success: false, error: 'Level already activated' };
      }

      // Check code usage limit
      const { data: usageData, error: usageError } = await supabase
        .from('user_level_activations')
        .select('id')
        .eq('activation_code_id', codeData.id);

      if (usageError) {
        return { success: false, error: 'Failed to check code usage' };
      }

      if (usageData && usageData.length >= codeData.max_uses) {
        return { success: false, error: 'Activation code has reached maximum usage limit' };
      }

      // Calculate expiration date
      const accessExpiresAt = new Date();
      accessExpiresAt.setDate(accessExpiresAt.getDate() + codeData.app_access_duration_days);

      // Create level activation record
      const { error: activationError } = await supabase
        .from('user_level_activations')
        .insert({
          user_id: user.id,
          folder_id: folderId,
          activation_code_id: codeData.id,
          access_expires_at: accessExpiresAt.toISOString()
        });

      if (activationError) {
        return { success: false, error: 'Failed to activate level' };
      }

      await refreshProfile();

      return { 
        success: true, 
        expiresAt: accessExpiresAt.toISOString()
      };
    } catch (error) {
      console.error('Level activation error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsActivating(false);
    }
  };

  return {
    activateLevel,
    isActivating,
    validateCodeFormat,
    formatCode
  };
};