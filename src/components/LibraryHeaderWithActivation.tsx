import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Lock, Unlock } from 'lucide-react';
import { useLevelAccess } from '@/hooks/useLevelAccess';
import { useTranslation } from 'react-i18next';

interface Folder {
  id: string;
  name: string;
}

interface LibraryHeaderWithActivationProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string, folderName: string) => void;
  onLockedLevelSelect: (folderId: string, folderName: string) => void;
}

const LevelItem: React.FC<{ 
  folder: Folder; 
  onSelect: (folderId: string, folderName: string) => void;
  onLockedSelect: (folderId: string, folderName: string) => void;
}> = ({ folder, onSelect, onLockedSelect }) => {
  const { data: levelAccess, isLoading } = useLevelAccess(folder.id);
  
  const isLocked = !isLoading && !levelAccess?.isActivated;
  
  const handleClick = () => {
    if (isLocked) {
      onLockedSelect(folder.id, folder.name);
    } else {
      onSelect(folder.id, folder.name);
    }
  };

  return (
    <SelectItem 
      key={folder.id} 
      value={folder.id}
      className={`${isLocked ? "text-muted-foreground" : ""}`}
      onSelect={() => handleClick()}
    >
      <div className="flex items-center justify-center gap-2 w-full">
        {isLoading ? (
          <div className="w-4 h-4 animate-pulse bg-muted rounded" />
        ) : isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Unlock className="h-4 w-4 text-green-600" />
        )}
        <span>{folder.name}</span>
        {isLocked && <span className="text-xs text-muted-foreground ml-2">Locked</span>}
      </div>
    </SelectItem>
  );
};

export const LibraryHeaderWithActivation: React.FC<LibraryHeaderWithActivationProps> = ({ 
  folders, 
  selectedFolderId, 
  onFolderSelect,
  onLockedLevelSelect
}) => {
  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const { data: selectedLevelAccess } = useLevelAccess(selectedFolderId);
  const { t } = useTranslation();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center mb-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('library.title')}</h1>
        </div>
      </div>
      
      <div className="flex justify-center">
        <div className="w-full max-w-sm">
          <Select 
            value={selectedFolderId || ''} 
            onValueChange={(folderId) => {
              const folder = folders.find(f => f.id === folderId);
              if (folder) {
                onFolderSelect(folderId, folder.name);
              }
            }}
          >
          <SelectTrigger className="w-full">
            <SelectValue 
              placeholder="Select a level..."
            >
              {selectedFolder ? (
                <div className="flex items-center justify-center gap-2">
                  {selectedLevelAccess?.isActivated ? (
                    <Unlock className="h-4 w-4 text-green-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {selectedFolder.name}
                </div>
              ) : (
                'Select a level...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {folders.map((folder) => (
              <LevelItem
                key={folder.id}
                folder={folder}
                onSelect={onFolderSelect}
                onLockedSelect={onLockedLevelSelect}
              />
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>
    </div>
  );
};