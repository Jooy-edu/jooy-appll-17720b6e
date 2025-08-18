import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useDocumentPages } from '@/hooks/useDocumentPages';
import { Loader2 } from 'lucide-react';

interface PageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export const PageSelector: React.FC<PageSelectorProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName
}) => {
  const [selectedPage, setSelectedPage] = useState('1');
  const navigate = useNavigate();
  const { data: pageData, isLoading } = useDocumentPages(documentId);

  const handlePageSelect = () => {
    const pageNumber = parseInt(selectedPage);
    if (pageNumber > 0 && (!pageData?.maxPages || pageNumber <= pageData.maxPages)) {
      navigate(`/worksheet/${documentId}/${pageNumber}`);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageSelect();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{documentName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-number" className="text-foreground">Page Number</Label>
            <Input
              id="page-number"
              type="number"
              min="1"
              max={pageData?.maxPages || undefined}
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter page number"
              className="text-center"
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading page info...</span>
              </div>
            ) : pageData?.maxPages && (
              <p className="text-sm text-muted-foreground text-center">
                Available pages: 1 - {pageData.maxPages}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handlePageSelect} 
              className="flex-1 bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
              disabled={!selectedPage || parseInt(selectedPage) < 1}
            >
              Go to Page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};