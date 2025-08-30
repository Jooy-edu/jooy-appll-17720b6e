import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-muted border rounded-lg px-3 py-2 shadow-lg">
        <WifiOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Changes will sync when connected
        </span>
      </div>
    </div>
  );
};