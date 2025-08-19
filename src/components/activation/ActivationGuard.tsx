import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActivation } from '@/hooks/useActivation';
import { Loader2 } from 'lucide-react';
import ActivationScreen from './ActivationScreen';

interface ActivationGuardProps {
  children: React.ReactNode;
}

const ActivationGuard: React.FC<ActivationGuardProps> = ({ children }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const { checkActivationStatus } = useActivation();
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user || authLoading) {
        setIsChecking(false);
        return;
      }

      try {
        // First check from profile if available
        if (profile) {
          setIsActivated(profile.jooy_app_activated);
          setIsChecking(false);
          return;
        }

        // Fallback to direct database check
        const activated = await checkActivationStatus(user.id);
        setIsActivated(activated);
      } catch (error) {
        console.error('Error checking activation status:', error);
        setIsActivated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();
  }, [user, profile, authLoading, checkActivationStatus]);

  // Show loading while checking authentication or activation status
  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking account status...</p>
        </div>
      </div>
    );
  }

  // User must be authenticated to reach this point
  if (!user) {
    return null; // This should be handled by ProtectedRoute
  }

  // Show activation screen if user is not activated
  if (isActivated === false) {
    return <ActivationScreen />;
  }

  // User is activated, show the protected content
  return <>{children}</>;
};

export default ActivationGuard;