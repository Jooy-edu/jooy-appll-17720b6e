interface ServiceWorkerUpdateEvent {
  type: 'SW_UPDATE_AVAILABLE';
  version: number;
}

interface ServiceWorkerManager {
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => void;
  onUpdateAvailable: (callback: (version: number) => void) => () => void;
}

class ServiceWorkerManagerImpl implements ServiceWorkerManager {
  private updateCallbacks = new Set<(version: number) => void>();
  private pendingUpdate: ServiceWorkerRegistration | null = null;

  constructor() {
    // Don't auto-register - let index.html handle registration to avoid duplicates
    this.setupMessageListener();
  }

  private setupMessageListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
          const version = event.data.version;
          this.updateCallbacks.forEach(callback => callback(version));
        }
      });
    }
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // Check for updates on registration
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            this.pendingUpdate = registration;
          }
        });

        // Listen for controlling service worker change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return false;

      await registration.update();
      
      // Wait a moment for update to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return !!registration.waiting;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  applyUpdate(): void {
    if (this.pendingUpdate?.waiting) {
      this.pendingUpdate.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: reload the page
      window.location.reload();
    }
  }

  onUpdateAvailable(callback: (version: number) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }
}

export const serviceWorkerManager = new ServiceWorkerManagerImpl();