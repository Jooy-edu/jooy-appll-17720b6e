import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Lock, Unlock } from 'lucide-react';
import { useLevelAccess } from '@/hooks/useLevelAccess';

interface Folder {
  id: string;
  name: string;
}

interface LibraryHeaderProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string, folderName: string) => void;
}

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({ 
  folders, 
  selectedFolderId, 
  onFolderSelect 
}) => {
  const selectedFolder = folders.find(f => f.id === selectedFolderId);

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
              {selectedFolder ? selectedFolder.name : 'Select a level...'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};