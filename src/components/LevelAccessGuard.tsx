import React from 'react';
import { useOptimizedLevelAccess } from '@/hooks/useOptimizedLevelAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LevelAccessGuardProps {
  folderId: string;
  children: (props: { isLocked: boolean }) => React.ReactNode;
  onActivateRequired: () => void;
}

export const LevelAccessGuard: React.FC<LevelAccessGuardProps> = ({
  folderId,
  children,
  onActivateRequired
}) => {
  const { data: levelAccess, isLoading, error, refetch } = useOptimizedLevelAccess(folderId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Level Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Unable to check your access to this level. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pass locked state to children instead of blocking
  const isLocked = !levelAccess?.isActivated;
  return <>{children({ isLocked })}</>;
};