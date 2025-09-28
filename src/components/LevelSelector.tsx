import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen } from 'lucide-react';
import { useRealtimeFolders } from '@/hooks/useRealtimeFolders';
import { useTranslation } from 'react-i18next';

interface LevelSelectorProps {
  onLevelSelect: (folderId: string, levelName: string) => void;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({ onLevelSelect }) => {
  const { data: folders, isLoading, error } = useRealtimeFolders();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading levels...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load levels</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!folders?.length) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No levels available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">{t('library.title')}</h1>
        <p className="text-muted-foreground">Select a level to browse documents</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <Card key={folder.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <BookOpen className="h-5 w-5 text-primary" />
                Level {folder.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => onLevelSelect(folder.id, folder.name)}
                className="w-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
              >
                Browse Documents
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};