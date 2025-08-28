import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Lock, Unlock } from 'lucide-react';
import { useLevelAccess } from '@/hooks/useLevelAccess';

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
      className={isLocked ? "text-muted-foreground" : ""}
      onSelect={() => handleClick()}
    >
      <div className="flex items-center gap-2 w-full">
        {isLoading ? (
          <div className="w-4 h-4 animate-pulse bg-muted rounded" />
        ) : isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Unlock className="h-4 w-4 text-green-600" />
        )}
        <span>{folder.name}</span>
        {isLocked && <span className="text-xs text-muted-foreground ml-auto">Locked</span>}
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

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Library</h1>
          <p className="text-muted-foreground">Select a level to view documents</p>
        </div>
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      
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
              className="text-left"
            >
              {selectedFolder ? (
                <div className="flex items-center gap-2">
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
  );
};