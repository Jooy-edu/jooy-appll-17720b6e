import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ActivationResult {
  success: boolean;
  accessExpiresAt?: string;
  error?: string;
}

export const useActivation = () => {
  const [isActivating, setIsActivating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const { user, refreshProfile } = useAuth();

  const validateCodeFormat = (code: string): boolean => {
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
  };

  const formatCode = (input: string): string => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Add dashes every 4 characters
    const formatted = cleaned.match(/.{1,4}/g)?.join('-') || cleaned;
    
    // Limit to 19 characters (16 alphanumeric + 3 dashes)
    return formatted.substring(0, 19);
  };

  const checkActivationStatus = async (userId: string): Promise<boolean> => {
    try {
      setIsCheckingStatus(true);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('jooy_app_activated')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking activation status:', error);
        return false;
      }

      return profile?.jooy_app_activated || false;
    } catch (error) {
      console.error('Failed to check activation status:', error);
      return false;
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const activateUser = async (activationCode: string): Promise<ActivationResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setIsActivating(true);

      // 1. Validate code format
      if (!validateCodeFormat(activationCode)) {
        return { success: false, error: 'Invalid code format. Please use XXXX-XXXX-XXXX-XXXX format.' };
      }

      // 2. Check if code exists and is valid
      const { data: codeData, error: codeError } = await supabase
        .from('activation_codes')
        .select('*')
        .eq('code', activationCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (codeError) {
        console.error('Error fetching activation code:', codeError);
        return { success: false, error: 'Failed to validate activation code. Please try again.' };
      }

      if (!codeData) {
        return { success: false, error: 'Invalid activation code. Please check your code and try again.' };
      }

      // 3. Check if code is expired
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        return { success: false, error: 'This activation code has expired.' };
      }

      // 4. Check if user is already activated
      const { data: profile } = await supabase
        .from('profiles')
        .select('jooy_app_activated')
        .eq('id', user.id)
        .single();

      if (profile?.jooy_app_activated) {
        return { success: false, error: 'Your account is already activated.' };
      }

      // 5. Check if code has been used (for single-use codes)
      if (codeData.max_uses === 1) {
        const { data: existingActivation } = await supabase
          .from('user_activations')
          .select('id')
          .eq('activation_code_id', codeData.id)
          .maybeSingle();

        if (existingActivation) {
          return { success: false, error: 'This activation code has already been used.' };
        }
      }

      // 6. Calculate access expiration
      const accessExpiresAt = new Date();
      // Use type assertion to access the field that exists in DB but not in types
      const durationDays = (codeData as any).app_access_duration_days || 365;
      accessExpiresAt.setDate(accessExpiresAt.getDate() + durationDays);

      // 7. Create user activation record
      const { error: activationError } = await supabase
        .from('user_activations')
        .insert({
          user_id: user.id,
          activation_code_id: codeData.id,
          app_access_expires_at: accessExpiresAt.toISOString()
        });

      if (activationError) {
        console.error('Error creating activation record:', activationError);
        return { success: false, error: 'Failed to activate account. Please try again.' };
      }

      // 8. Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ jooy_app_activated: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return { success: false, error: 'Failed to update account status. Please try again.' };
      }

      // Refresh profile data in auth context
      await refreshProfile();

      toast({
        title: "Account Activated!",
        description: "Welcome to Jooy! Your account has been successfully activated.",
      });

      return {
        success: true,
        accessExpiresAt: accessExpiresAt.toISOString()
      };

    } catch (error) {
      console.error('Activation failed:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setIsActivating(false);
    }
  };

  return {
    activateUser,
    checkActivationStatus,
    formatCode,
    validateCodeFormat,
    isActivating,
    isCheckingStatus
  };
};