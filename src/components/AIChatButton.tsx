import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import ApiKeyManager from "@/components/ApiKeyManager";
import type { RegionData, WorksheetMetadata, GuidanceItem } from "@/types/worksheet";

interface AIChatButtonProps {
  worksheetId: string;
  pageNumber: number;
  isTextModeActive: boolean;
  activeRegion?: RegionData | null;
  activeGuidance?: GuidanceItem | null;
  currentStepIndex?: number;
  pdfUrl: string;
  worksheetMeta: WorksheetMetadata;
  pageDescriptionForAI?: string;
}

const AIChatButton: React.FC<AIChatButtonProps> = ({ 
  worksheetId, 
  pageNumber, 
  isTextModeActive,
  activeRegion,
  activeGuidance,
  currentStepIndex = 0,
  pdfUrl,
  worksheetMeta,
  pageDescriptionForAI
}) => {
  const navigate = useNavigate();
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);

  const handleClick = () => {
    // Check if API key exists in localStorage
    const apiKey = localStorage.getItem('gemini-api-key');
    
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "You need to set up your Gemini API key to use AI chat.",
        variant: "destructive"
      });
      setShowApiKeyManager(true);
      return;
    }
    
    // DEBUG: Check session state before navigating to AI chat
    const sessionKey = `worksheet_page_state_${worksheetId}_${pageNumber}`;
    const currentSessionState = sessionStorage.getItem(sessionKey);
    console.log('🔍 [DEBUG] AIChatButton - Session state BEFORE navigating to AI chat:', {
      sessionKey,
      currentSessionState,
      parsedState: currentSessionState ? JSON.parse(currentSessionState) : null
    });
    
    // Navigate to chat page with state including worksheet data
    navigate(`/chat/${worksheetId}/${pageNumber}`, { 
      state: { 
        fromTextMode: isTextModeActive,
        activeRegion: activeRegion,
        activeGuidance: activeGuidance,
        currentStepIndex: currentStepIndex,
        currentGuidanceStepIndex: currentStepIndex,
        pdfUrl: pdfUrl,
        worksheetMeta: worksheetMeta,
        pageDescriptionForAI: pageDescriptionForAI
      } 
    });
  };

  console.log('🔍 [DEBUG] AIChatButton rendering - should this be visible?', {
    worksheetId,
    pageNumber,
    isTextModeActive,
    hasActiveGuidance: !!activeGuidance
  });

  const buttonClasses = cn(
    "fixed bottom-4 z-50 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg",
    isTextModeActive ? "left-4 h-10 w-10" : "left-1/2 -translate-x-1/2 h-14 w-14 p-0"
  );

  return (
    <>
      <Button
        onClick={handleClick}
        className={buttonClasses}
        aria-label="AI Chat"
      >
        <MessageSquareText className={isTextModeActive ? "h-5 w-5" : "h-8 w-8"} />
      </Button>
      
      {showApiKeyManager && (
        <ApiKeyManager 
          isOpen={showApiKeyManager}
          onClose={() => setShowApiKeyManager(false)}
          onApiKeySet={() => {
            setShowApiKeyManager(false);
            // Retry the chat navigation after API key is set
            handleClick();
          }}
        />
      )}
    </>
  );
};

export default AIChatButton;