import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText, Lock } from 'lucide-react';
import { useRealtimeDocuments } from '@/hooks/useRealtimeDocuments';
import { useCoverImage } from '@/hooks/useCoverImage';

interface DocumentGridProps {
  folderId: string;
  levelName: string;
  onDocumentSelect: (documentId: string, documentName: string) => void;
  isLocked?: boolean;
  onActivateRequired?: () => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({ 
  folderId, 
  levelName, 
  onDocumentSelect,
  isLocked = false,
  onActivateRequired
}) => {
  const { data: documents, isLoading, error } = useRealtimeDocuments(folderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load documents</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!documents?.length) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No documents available in Level {levelName}</p>
      </div>
    );
  }

  const handleButtonClick = (document: any) => {
    if (isLocked && onActivateRequired) {
      onActivateRequired();
    } else {
      onDocumentSelect(document.id, document.name);
    }
  };

  const DocumentCard = ({ document }: { document: any }) => {
    const { coverUrl, isLoading } = useCoverImage(document.id, document.metadata);

    return (
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${isLocked ? 'opacity-75' : ''}`}>
        <CardHeader className="p-4">
          {/* Cover Image Section */}
          <div className="aspect-[4/3] w-full mb-3 overflow-hidden rounded-md bg-muted">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : coverUrl ? (
              <img
                src={coverUrl}
                alt={`${document.name} cover`}
                className="w-full h-full object-cover transition-transform hover:scale-105"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.removeAttribute('style');
                }}
              />
            ) : null}
            {/* Fallback Icon */}
            <div 
              className={`w-full h-full flex items-center justify-center ${coverUrl && !isLoading ? 'hidden' : ''}`}
              style={coverUrl && !isLoading ? { display: 'none' } : {}}
            >
              {isLocked ? (
                <Lock className="h-12 w-12 text-muted-foreground" />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {/* Document Title */}
          <CardTitle className="flex items-center gap-2 text-card-foreground text-sm font-medium">
            {isLocked ? (
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            )}
            <span className="truncate">{document.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Button 
            onClick={() => handleButtonClick(document)}
            className={`w-full ${isLocked ? 'bg-muted hover:bg-muted/80 text-muted-foreground' : 'bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white'}`}
          >
            {isLocked ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Unlock Level
              </>
            ) : (
              'Select Document'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
};