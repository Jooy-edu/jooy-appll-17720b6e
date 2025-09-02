import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';
import { serviceWorkerManager } from '@/utils/serviceWorkerManager';

export const AppUpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = serviceWorkerManager.onUpdateAvailable((version) => {
      setUpdateAvailable(true);
      setUpdateVersion(version);
      
      // Show toast notification
      toast('New version available!', {
        description: 'A new version of the app is ready to install.',
        action: {
          label: 'Update Now',
          onClick: handleUpdate,
        },
        duration: Infinity, // Keep it visible until user action
      });
    });

    return unsubscribe;
  }, []);

  const handleUpdate = () => {
    serviceWorkerManager.applyUpdate();
    setUpdateAvailable(false);
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    toast.dismiss();
  };

  // Component doesn't render UI directly - uses toast system
  return null;
};

export const useManualUpdateCheck = () => {
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    if (checking) return;
    
    setChecking(true);
    
    try {
      const hasUpdate = await serviceWorkerManager.checkForUpdates();
      
      if (hasUpdate) {
        toast.success('Update found!', {
          description: 'A new version is available and ready to install.',
          action: {
            label: 'Install Now',
            onClick: () => serviceWorkerManager.applyUpdate(),
          },
        });
      } else {
        toast.success('You\'re up to date!', {
          description: 'You have the latest version of the app.',
        });
      }
    } catch (error) {
      toast.error('Update check failed', {
        description: 'Unable to check for updates. Please try again later.',
      });
    } finally {
      setChecking(false);
    }
  };

  return { checkForUpdates, checking };
};