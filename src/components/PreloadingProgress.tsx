import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PreloadingProgressProps {
  isPreloading: boolean;
  progress: {
    phase: 'initializing' | 'documents' | 'worksheets' | 'covers' | 'completed' | 'failed';
    current: number;
    total: number;
    currentItem?: string;
    percentage: number;
  };
  onCancel?: () => void;
  error?: string;
  className?: string;
}

const phaseLabels = {
  initializing: 'Preparing to download...',
  documents: 'Loading document metadata...',
  worksheets: 'Downloading worksheet content...',
  covers: 'Preloading cover images...',
  completed: 'Download completed!',
  failed: 'Download failed'
};

const phaseIcons = {
  initializing: Loader2,
  documents: Download,
  worksheets: Download,
  covers: Download,
  completed: CheckCircle,
  failed: AlertCircle
};

export const PreloadingProgress = ({
  isPreloading,
  progress,
  onCancel,
  error,
  className = ""
}: PreloadingProgressProps) => {
  if (!isPreloading && progress.phase !== 'completed' && progress.phase !== 'failed') {
    return null;
  }

  const Icon = phaseIcons[progress.phase];
  const isCompleted = progress.phase === 'completed';
  const isFailed = progress.phase === 'failed';

  return (
    <Card className={`border-border/50 bg-background/95 backdrop-blur-sm ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Icon 
              className={`h-5 w-5 ${
                isCompleted ? 'text-green-500' : 
                isFailed ? 'text-red-500' : 
                'text-primary animate-spin'
              }`} 
            />
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {phaseLabels[progress.phase]}
              </h4>
              {progress.currentItem && !isCompleted && !isFailed && (
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.currentItem}
                </p>
              )}
            </div>
          </div>
          
          {isPreloading && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!isCompleted && !isFailed && (
          <>
            <Progress 
              value={progress.percentage} 
              className="h-2 mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {progress.current} of {progress.total} items
              </span>
              <span>{progress.percentage}%</span>
            </div>
          </>
        )}

        {isFailed && error && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
            {error}
          </div>
        )}

        {isCompleted && (
          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-600">
            Level content is now available offline!
          </div>
        )}
      </CardContent>
    </Card>
  );
};