import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('PWAInstallPrompt: Component mounted');
    
    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check if running in standalone mode (installed PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check if running in PWA mode on iOS
      const isIOSPWA = (window.navigator as any).standalone === true;
      
      const installed = isStandalone || isIOSPWA;
      console.log('PWAInstallPrompt: App installed status:', {
        isStandalone,
        isIOSPWA,
        installed
      });
      
      // FORCE TESTING: Always set to false to show prompt
      console.log('PWAInstallPrompt: FORCING isInstalled to false for testing');
      setIsInstalled(false);
    };

    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWAInstallPrompt: beforeinstallprompt event fired', e);
      
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      
      const installEvent = e as BeforeInstallPromptEvent;
      console.log('PWAInstallPrompt: Setting deferredPrompt', installEvent);
      setDeferredPrompt(installEvent);
      
      // Show our custom install prompt immediately if app is not installed
      if (!isInstalled) {
        console.log('PWAInstallPrompt: App not installed, showing prompt');
        setShowInstallPrompt(true);
      } else {
        console.log('PWAInstallPrompt: App already installed, not showing prompt');
      }
    };

    // Listen for successful app install
    const handleAppInstalled = () => {
      console.log('PWAInstallPrompt: App was installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    console.log('PWAInstallPrompt: Adding event listeners');
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      console.log('PWAInstallPrompt: Removing event listeners');
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    console.log('PWAInstallPrompt: Install button clicked', { deferredPrompt });
    
    if (!deferredPrompt) {
      console.log('PWAInstallPrompt: No deferredPrompt available');
      return;
    }

    // Hide our custom prompt
    setShowInstallPrompt(false);

    // Show the browser's install prompt
    try {
      console.log('PWAInstallPrompt: Calling deferredPrompt.prompt()');
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      console.log('PWAInstallPrompt: User choice result:', choiceResult);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWAInstallPrompt: User accepted the install prompt');
      } else {
        console.log('PWAInstallPrompt: User dismissed the install prompt');
      }
    } catch (error) {
      console.error('PWAInstallPrompt: Error showing install prompt:', error);
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    console.log('PWAInstallPrompt: Prompt dismissed by user');
    setShowInstallPrompt(false);
  };

  // Debug logging for render conditions
  console.log('PWAInstallPrompt: Render check', {
    isInstalled,
    showInstallPrompt,
    deferredPrompt: !!deferredPrompt
  });

  // Don't render if app is already installed or no prompt is available
  if (isInstalled || !showInstallPrompt || !deferredPrompt) {
    console.log('PWAInstallPrompt: Not rendering prompt', {
      isInstalled,
      showInstallPrompt,
      hasDeferredPrompt: !!deferredPrompt
    });
    return null;
  }

  console.log('PWAInstallPrompt: Rendering install prompt');

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-orange-magenta rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900">
                Install Jooy
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Add to your home screen for quick access
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="flex-shrink-0 h-6 w-6 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-3 flex space-x-2">
          <Button
            onClick={handleInstallClick}
            className="flex-1 bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white text-sm h-8"
          >
            Install
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="px-3 text-sm h-8"
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;