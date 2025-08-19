import React, { useState, useEffect } from 'react';
import { LibraryHeader } from '@/components/LibraryHeader';
import { DocumentGrid } from '@/components/DocumentGrid';
import { PageSelector } from '@/components/PageSelector';
import { useRealtimeFolders } from '@/hooks/useRealtimeFolders';
import { Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SelectedLevel {
  folderId: string;
  levelName: string;
}

interface PageSelectorState {
  documentId: string;
  documentName: string;
}

const SELECTED_LEVEL_KEY = 'selectedLibraryLevel';

export const LibraryPage: React.FC = () => {
  const { data: folders, isLoading, error } = useRealtimeFolders();
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel | null>(null);
  const [pageSelectorState, setPageSelectorState] = useState<PageSelectorState | null>(null);

  // Load saved level from localStorage on mount
  useEffect(() => {
    const savedLevel = localStorage.getItem(SELECTED_LEVEL_KEY);
    if (savedLevel) {
      try {
        const parsedLevel = JSON.parse(savedLevel);
        setSelectedLevel(parsedLevel);
      } catch (error) {
        console.error('Failed to parse saved level:', error);
        localStorage.removeItem(SELECTED_LEVEL_KEY);
      }
    }
  }, []);

  // Auto-select first available level if no level is selected and folders are loaded
  useEffect(() => {
    if (!selectedLevel && folders?.length && !isLoading) {
      const firstFolder = folders[0];
      const newLevel = { folderId: firstFolder.id, levelName: firstFolder.name };
      setSelectedLevel(newLevel);
      localStorage.setItem(SELECTED_LEVEL_KEY, JSON.stringify(newLevel));
    }
  }, [folders, selectedLevel, isLoading]);

  // Validate selected level still exists when folders change
  useEffect(() => {
    if (selectedLevel && folders?.length) {
      const levelExists = folders.some(folder => folder.id === selectedLevel.folderId);
      if (!levelExists) {
        // Selected level no longer exists, fall back to first available
        const firstFolder = folders[0];
        if (firstFolder) {
          const newLevel = { folderId: firstFolder.id, levelName: firstFolder.name };
          setSelectedLevel(newLevel);
          localStorage.setItem(SELECTED_LEVEL_KEY, JSON.stringify(newLevel));
        } else {
          setSelectedLevel(null);
          localStorage.removeItem(SELECTED_LEVEL_KEY);
        }
      }
    }
  }, [folders, selectedLevel]);

  const handleLevelSelect = (folderId: string, levelName: string) => {
    const newLevel = { folderId, levelName };
    setSelectedLevel(newLevel);
    localStorage.setItem(SELECTED_LEVEL_KEY, JSON.stringify(newLevel));
    // Close page selector if open
    setPageSelectorState(null);
  };

  const handleDocumentSelect = (documentId: string, documentName: string) => {
    setPageSelectorState({ documentId, documentName });
  };

  const handlePageSelectorClose = () => {
    setPageSelectorState(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading library...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">
            <p className="text-destructive mb-4">Failed to load library</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!folders?.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No levels available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <LibraryHeader
          folders={folders}
          selectedFolderId={selectedLevel?.folderId || null}
          onFolderSelect={handleLevelSelect}
        />
        
        {selectedLevel && (
          <DocumentGrid
            folderId={selectedLevel.folderId}
            levelName={selectedLevel.levelName}
            onDocumentSelect={handleDocumentSelect}
          />
        )}
        
        {pageSelectorState && (
          <PageSelector
            isOpen={true}
            onClose={handlePageSelectorClose}
            documentId={pageSelectorState.documentId}
            documentName={pageSelectorState.documentName}
          />
        )}
      </div>
    </div>
  );
};