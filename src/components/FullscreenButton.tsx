import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Maximize } from "lucide-react";

const FullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

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
  if (isFullscreen || isPWA) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-auto">
          <Maximize className="h-24 w-24 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enable Fullscreen
          </h2>
          <p className="text-gray-600 mb-6">
            For the best learning experience, please enable fullscreen mode
          </p>
          <Button
            onClick={handleClick}
            className="w-full h-14 text-lg font-semibold bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white rounded-xl shadow-lg"
            aria-label="Enable Fullscreen"
          >
            <Maximize className="h-6 w-6 mr-2" />
            Go Fullscreen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FullscreenButton;