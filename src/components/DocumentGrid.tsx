import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Lock } from 'lucide-react';
import { useRealtimeDocuments } from '@/hooks/useRealtimeDocuments';

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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((document) => (
        <Card key={document.id} className={`hover:shadow-lg transition-shadow cursor-pointer ${isLocked ? 'opacity-75' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              {isLocked ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
              {document.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
      ))}
    </div>
  );
};