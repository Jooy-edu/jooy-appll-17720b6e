import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  Cloud, 
  Smartphone, 
  Merge 
} from 'lucide-react';

export interface ConflictData {
  id: string;
  type: 'cover' | 'document' | 'worksheet';
  operation: 'create' | 'update' | 'delete';
  clientData: any;
  serverData: any;
  timestamp: number;
}

interface ConflictResolutionModalProps {
  conflicts: ConflictData[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (conflictId: string, resolution: 'client' | 'server' | 'merge') => void;
  onResolveAll: (resolution: 'client' | 'server' | 'merge') => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflicts,
  isOpen,
  onClose,
  onResolve,
  onResolveAll
}) => {
  if (conflicts.length === 0) return null;

  const formatData = (data: any) => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2).slice(0, 100) + '...';
    }
    return String(data);
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'cover': return '🖼️';
      case 'document': return '📄';
      case 'worksheet': return '📊';
      default: return '❓';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Data Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} found between your local data and server data. 
            Choose how to resolve each conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Batch Resolution Options */}
          {conflicts.length > 1 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Resolve All Conflicts</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResolveAll('client')}
                  className="flex items-center gap-2"
                >
                  <Smartphone className="h-4 w-4" />
                  Keep Local Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResolveAll('server')}
                  className="flex items-center gap-2"
                >
                  <Cloud className="h-4 w-4" />
                  Use Server Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResolveAll('merge')}
                  className="flex items-center gap-2"
                >
                  <Merge className="h-4 w-4" />
                  Merge When Possible
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Individual Conflicts */}
          <div className="space-y-6">
            {conflicts.map((conflict, index) => (
              <div key={conflict.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getConflictIcon(conflict.type)}</span>
                    <div>
                      <h4 className="font-medium capitalize">
                        {conflict.type} {conflict.operation}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        ID: {conflict.id}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    Conflict #{index + 1}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Client Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <span className="font-medium">Your Local Data</span>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 text-sm font-mono">
                      {formatData(conflict.clientData)}
                    </div>
                  </div>

                  {/* Server Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      <span className="font-medium">Server Data</span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 rounded p-3 text-sm font-mono">
                      {formatData(conflict.serverData)}
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(conflict.id, 'client')}
                    className="flex items-center gap-2"
                  >
                    <Smartphone className="h-4 w-4" />
                    Keep Local
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(conflict.id, 'server')}
                    className="flex items-center gap-2"
                  >
                    <Cloud className="h-4 w-4" />
                    Use Server
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(conflict.id, 'merge')}
                    className="flex items-center gap-2"
                  >
                    <Merge className="h-4 w-4" />
                    Try Merge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Resolve Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};