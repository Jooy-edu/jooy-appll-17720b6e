import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Maximize, X } from "lucide-react";

const FullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [showDialog, setShowDialog] = useState(true);

  useEffect(() => {
    // Check if running as PWA
    const checkPWAMode = () => {
      // Check for standalone mode (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check for iOS PWA
      const isIOSPWA = (window.navigator as any).standalone === true;
      // Check for fullscreen mode
      const isFullscreenMode = window.matchMedia('(display-mode: fullscreen)').matches;
      
      const isPWAMode = isStandalone || isIOSPWA || isFullscreenMode;
      setIsPWA(isPWAMode);
      
      console.log('PWA Mode Detection:', {
        isStandalone,
        isIOSPWA,
        isFullscreenMode,
        isPWAMode
      });
    };

    checkPWAMode();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleClick = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  // Don't render the button if:
  // 1. Already in fullscreen mode
  // 2. Running as a PWA (since PWA should be fullscreen by default)
  // 3. Dialog was manually closed
  if (isFullscreen || isPWA || !showDialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-auto relative">
          {/* Close button */}
          <Button
            onClick={() => setShowDialog(false)}
            className="absolute top-4 right-4 h-8 w-8 p-0 bg-gray-100 hover:bg-gray-200 text-gray-600"
            size="icon"
            variant="ghost"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>

          <Maximize className="h-24 w-24 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enable Fullscreen
          </h2>
          <p className="text-gray-600 mb-6">
            For the best learning experience, please enable fullscreen mode
          </p>
          
          {/* Fullscreen button */}
          <Button
            onClick={handleClick}
            className="w-full h-12 text-lg font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg"
            aria-label="Enable Fullscreen"
          >
            <Maximize className="h-5 w-5 mr-2" />
            Go Fullscreen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FullscreenButton;