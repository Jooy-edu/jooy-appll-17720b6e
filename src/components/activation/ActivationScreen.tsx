import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Sparkles } from 'lucide-react';
import ActivationCodeInput from './ActivationCodeInput';

const ActivationScreen: React.FC = () => {
  const [isActivated, setIsActivated] = useState(false);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string>('');

  const handleActivationSuccess = (expiresAt: string) => {
    setAccessExpiresAt(expiresAt);
    setIsActivated(true);
    
    // Auto-refresh the page after a short delay to show the main app
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">
              Welcome to Jooy!
            </CardTitle>
            <CardDescription>
              Your account has been successfully activated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                Your access is valid until {formatExpirationDate(accessExpiresAt)}
              </AlertDescription>
            </Alert>
            <p className="text-center text-sm text-muted-foreground">
              Redirecting you to the app...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-orange-magenta">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Activate Your Jooy Account
          </CardTitle>
          <CardDescription>
            Enter your activation code to get started with Jooy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivationCodeInput onSuccess={handleActivationSuccess} />
          
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p className="text-center">
              Need help? Contact support for assistance with your activation code.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivationScreen;