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
    <Button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-transparent hover:bg-transparent"
      size="icon"
      variant="ghost"
      aria-label="Toggle Fullscreen"
    >
      <Maximize className="h-20 w-20 text-blue-600" />
    </Button>
  );
};

export default FullscreenButton;