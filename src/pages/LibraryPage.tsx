import React, { useState } from 'react';
import { LevelSelector } from '@/components/LevelSelector';
import { DocumentGrid } from '@/components/DocumentGrid';
import { PageSelector } from '@/components/PageSelector';

type ViewState = 
  | { type: 'levels' }
  | { type: 'documents'; folderId: string; levelName: string }
  | { type: 'pageSelector'; documentId: string; documentName: string };

export const LibraryPage: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>({ type: 'levels' });

  const handleLevelSelect = (folderId: string, levelName: string) => {
    setViewState({ type: 'documents', folderId, levelName });
  };

  const handleDocumentSelect = (documentId: string, documentName: string) => {
    setViewState({ type: 'pageSelector', documentId, documentName });
  };

  const handleBack = () => {
    setViewState({ type: 'levels' });
  };

  const handlePageSelectorClose = () => {
    if (viewState.type === 'pageSelector') {
      // Go back to documents view
      const lastDocumentView = sessionStorage.getItem('lastDocumentView');
      if (lastDocumentView) {
        const { folderId, levelName } = JSON.parse(lastDocumentView);
        setViewState({ type: 'documents', folderId, levelName });
      } else {
        setViewState({ type: 'levels' });
      }
    }
  };

  // Store last document view for navigation
  React.useEffect(() => {
    if (viewState.type === 'documents') {
      sessionStorage.setItem('lastDocumentView', JSON.stringify({
        folderId: viewState.folderId,
        levelName: viewState.levelName
      }));
    }
  }, [viewState]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {viewState.type === 'levels' && (
          <LevelSelector onLevelSelect={handleLevelSelect} />
        )}
        
        {viewState.type === 'documents' && (
          <DocumentGrid
            folderId={viewState.folderId}
            levelName={viewState.levelName}
            onDocumentSelect={handleDocumentSelect}
            onBack={handleBack}
          />
        )}
        
        {viewState.type === 'pageSelector' && (
          <PageSelector
            isOpen={true}
            onClose={handlePageSelectorClose}
            documentId={viewState.documentId}
            documentName={viewState.documentName}
          />
        )}
      </div>
    </div>
  );
};