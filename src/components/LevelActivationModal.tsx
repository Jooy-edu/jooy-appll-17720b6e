import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock } from 'lucide-react';
import { useLevelActivation } from '@/hooks/useLevelActivation';
import { useUserActivatedLevels } from '@/hooks/useUserActivatedLevels';
import { useLevelPreloader } from '@/hooks/useLevelPreloader';
import { useTranslation } from 'react-i18next';

interface Folder {
  id: string;
  name: string;
}

interface LevelActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  preselectedFolderId?: string;
  onSuccess: (folderId: string, folderName: string) => void;
}

export const LevelActivationModal: React.FC<LevelActivationModalProps> = ({
  isOpen,
  onClose,
  folders,
  preselectedFolderId,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [activationCode, setActivationCode] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(preselectedFolderId || '');
  const [error, setError] = useState('');
  
  const { activateLevel, isActivating, validateCodeFormat, formatCode } = useLevelActivation();
  const { data: activatedLevelIds = [], isLoading: loadingActivatedLevels } = useUserActivatedLevels();
  const { preloadLevel } = useLevelPreloader();

  // Filter out already activated levels
  const availableFolders = folders.filter(folder => !activatedLevelIds.includes(folder.id));

  useEffect(() => {
    if (preselectedFolderId) {
      setSelectedFolderId(preselectedFolderId);
    }
  }, [preselectedFolderId]);

  const handleInputChange = (value: string) => {
    const formatted = formatCode(value);
    setActivationCode(formatted);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFolderId) {
      setError('Please select a level to unlock');
      return;
    }

    const cleanCode = activationCode.replace(/[-\s]/g, '');
    
    if (!validateCodeFormat(cleanCode)) {
      setError('Please enter a valid 16-character activation code');
      return;
    }

    try {
      const result = await activateLevel(activationCode, selectedFolderId);
      
      if (result.success) {
        const selectedFolder = folders.find(f => f.id === selectedFolderId);
        if (selectedFolder) {
          // Trigger preloading after successful activation
          preloadLevel(selectedFolderId, selectedFolder.name);
          onSuccess(selectedFolderId, selectedFolder.name);
        }
        onClose();
        setActivationCode('');
        setError('');
      } else {
        setError(result.error || 'Activation failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleClose = () => {
    onClose();
    setActivationCode('');
    setError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Activate Level
          </DialogTitle>
          <DialogDescription>
            {loadingActivatedLevels ? (
              "Loading available levels..."
            ) : availableFolders.length === 0 ? (
              "All levels are already activated! You have access to all available content."
            ) : (
              `Enter your activation code and select which level you want to unlock. ${availableFolders.length} level${availableFolders.length === 1 ? '' : 's'} available.`
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingActivatedLevels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading available levels...</span>
          </div>
        ) : availableFolders.length === 0 ? (
          <div className="text-center py-8">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">All Levels Activated!</h3>
            <p className="text-muted-foreground">
              You already have access to all available levels. No activation needed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="level-select">Select Level</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a level to unlock..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      Level {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          <div className="space-y-2">
            <Label htmlFor="activation-code">Activation Code</Label>
            <Input
              id="activation-code"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={activationCode}
              onChange={(e) => handleInputChange(e.target.value)}
              maxLength={19}
              className="font-mono"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isActivating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isActivating || !selectedFolderId || !activationCode.trim()}
              >
                {isActivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  'Activate Level'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};