import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasAnyLevelAccess } from '@/hooks/useHasAnyLevelAccess';
import { useDocumentFolderAccess } from '@/hooks/useDocumentFolderAccess';
import { Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivationGuardProps {
  children: React.ReactNode;
  documentId?: string;
}

const ActivationGuard: React.FC<ActivationGuardProps> = ({ children, documentId }) => {
  console.log('ActivationGuard: Component mounted with new logic', { documentId });
  
  const { user, loading: authLoading } = useAuth();
  const { data: levelAccessData, isLoading: generalLoading, error: generalError } = useHasAnyLevelAccess();
  const documentAccess = useDocumentFolderAccess(documentId);
  
  console.log('ActivationGuard: Hook data', { 
    user: user?.id, 
    authLoading, 
    generalLoading, 
    levelAccessData, 
    generalError,
    documentAccess 
  });

  // If documentId is provided, use document-specific access logic
  if (documentId) {
    // Show loading while checking document access
    if (authLoading || documentAccess.isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Checking document access...</p>
          </div>
        </div>
      );
    }

    // User must be authenticated
    if (!user) {
      return null; // This should be handled by ProtectedRoute
    }

    // Show error if there's an issue checking document access
    if (documentAccess.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-center text-destructive">Document Access Check Failed</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Unable to check document access. Please try refreshing the page.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // If document doesn't require level access (no folder), allow access
    if (!documentAccess.requiresLevelAccess) {
      return <>{children}</>;
    }

    // If document requires level access but user doesn't have it, show activation required
    if (!documentAccess.hasAccess) {
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
                This document belongs to a protected level that requires activation.
              </p>
              <p className="text-sm text-muted-foreground">
                Navigate to the library to activate the required level.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // User has access, show the content
    return <>{children}</>;
  }

  // Fallback to general level access logic when no documentId is provided
  // Show loading while checking authentication or level access status
  if (authLoading || generalLoading) {
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
  if (generalError) {
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