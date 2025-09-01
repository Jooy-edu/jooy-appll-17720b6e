import { useOfflineCoverImage, preloadCovers } from '@/hooks/useOfflineCoverImage';
import { useOfflineDocuments } from '@/hooks/useOfflineFirst';
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText, Lock } from 'lucide-react';
import { useRealtimeDocuments } from '@/hooks/useRealtimeDocuments';

import { useIsMobile } from '@/hooks/use-mobile';

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
  const { data: documents, isLoading, error, refetch } = useRealtimeDocuments(folderId);
  const isMobile = useIsMobile();

  // Preload covers when documents are loaded
  useEffect(() => {
    if (documents?.length) {
      const documentIds = documents.map(doc => doc.id);
      preloadCovers(documentIds);
    }
  }, [documents]);

  const getGridClasses = () => {
    const documentCount = documents?.length || 0;
    
    if (isMobile) {
      return documentCount <= 6 
        ? "grid gap-4 grid-cols-2" 
        : "grid gap-4 grid-cols-3";
    }
    return "grid gap-4 md:grid-cols-2 lg:grid-cols-3";
  };

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
        <Button variant="outline" onClick={() => refetch()}>
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
    const { coverUrl, isLoading } = useOfflineCoverImage(document.id, document.metadata);

    return (
      <Card 
        className={`hover:shadow-lg transition-all cursor-pointer ${isLocked ? 'opacity-75' : 'hover:scale-[1.02]'} overflow-hidden`}
        onClick={() => handleButtonClick(document)}
      >
        {/* Full Cover Image */}
        <div className={`w-full h-full ${isMobile && documents && documents.length > 6 ? 'min-h-[150px]' : 'min-h-[200px]'} bg-white relative`}>
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : coverUrl ? (
            <img
              src={coverUrl}
              alt={`Document cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            // Fallback Icon for documents without covers
            <div className="w-full h-full flex items-center justify-center">
              {isLocked ? (
                <Lock className="h-16 w-16 text-muted-foreground" />
              ) : (
                <FileText className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
          )}
          
          {/* Lock overlay for locked documents */}
          {isLocked && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="bg-muted/90 rounded-full p-3">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className={`${getGridClasses()} direction-rtl`} style={{ direction: 'rtl' }}>
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
};