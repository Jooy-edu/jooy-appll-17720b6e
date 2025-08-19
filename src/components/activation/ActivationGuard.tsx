import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasAnyLevelAccess } from '@/hooks/useHasAnyLevelAccess';
import { Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivationGuardProps {
  children: React.ReactNode;
}

const ActivationGuard: React.FC<ActivationGuardProps> = ({ children }) => {
  console.log('ActivationGuard: Component mounted with new logic');
  
  const { user, loading: authLoading } = useAuth();
  const { data: levelAccessData, isLoading, error } = useHasAnyLevelAccess();
  
  console.log('ActivationGuard: Hook data', { 
    user: user?.id, 
    authLoading, 
    isLoading, 
    levelAccessData, 
    error 
  });

  // Show loading while checking authentication or level access status
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking level access...</p>
        </div>
      </div>
    );
  }

  // User must be authenticated to reach this point
  if (!user) {
    return null; // This should be handled by ProtectedRoute
  }

  // Show error if there's an issue checking level access
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Access Check Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Unable to check your level access. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show level activation required screen if user has no level activations
  if (!levelAccessData?.hasAnyAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Lock className="h-6 w-6" />
              Level Activation Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Welcome! To access the application, you need to activate at least one level with an activation code.
            </p>
            <p className="text-sm text-muted-foreground">
              Navigate to the library to select and activate your first level.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has level activations, show the protected content
  return <>{children}</>;
};

export default ActivationGuard;