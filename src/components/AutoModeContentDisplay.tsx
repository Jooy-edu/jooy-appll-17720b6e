import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles, UserRound } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import type { AutoModePageData, GuidanceItem } from "@/types/worksheet";

interface AutoModeContentDisplayProps {
  worksheetId: string;
  pageNumber: number;
  autoModePageData: AutoModePageData;
  pdfUrl: string;
  onTextModeChange?: (isTextMode: boolean) => void;
  onGuidanceStateChange?: (guidance: GuidanceItem | null, stepIndex: number) => void;
}

const AutoModeContentDisplay: React.FC<AutoModeContentDisplayProps> = ({
  worksheetId,
  pageNumber,
  autoModePageData,
  pdfUrl,
  onTextModeChange,
  onGuidanceStateChange
}) => {
  const { t } = useTranslation();
  
  const [activeGuidance, setActiveGuidance] = useState<GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  
  // Virtual tutor selection state
  const [selectedTutorVideoUrl, setSelectedTutorVideoUrl] = useState<string>(() => {
    return localStorage.getItem('selectedVirtualTutor') || '/video/1.mp4';
  });
  const [showTutorSelectionModal, setShowTutorSelectionModal] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Initial audio availability check
  useEffect(() => {
    if (!audioCheckPerformed && autoModePageData.guidance.length > 0) {
      const firstGuidance = autoModePageData.guidance[0];
      if (!firstGuidance || !firstGuidance.audioName) {
        setAudioAvailable(false);
        setAudioCheckPerformed(true);
        return;
      }
      
      const audioPath = `/audio/${worksheetId}/${firstGuidance.audioName}_1.mp3`;
      
      const testAudio = new Audio();
      let checkCompleted = false;
      
      const completeCheck = (available: boolean) => {
        if (checkCompleted) return;
        checkCompleted = true;
        
        setAudioAvailable(available);
        setAudioCheckPerformed(true);
        
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
      };
      
      const handleCanPlay = () => {
        completeCheck(true);
      };
      
      const handleError = () => {
        completeCheck(false);
      };
      
      testAudio.addEventListener('canplaythrough', handleCanPlay);
      testAudio.addEventListener('error', handleError);
      
      const timeout = setTimeout(() => {
        completeCheck(false);
      }, 3000);
      
      testAudio.src = audioPath;
      testAudio.load();
      
      return () => {
        clearTimeout(timeout);
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
        if (!checkCompleted) {
          testAudio.src = '';
        }
      };
    }
  }, [worksheetId, autoModePageData.guidance, audioCheckPerformed]);

  // Notify parent about text mode changes
  useEffect(() => {
    if (onTextModeChange) {
      onTextModeChange(!!activeGuidance);
    }
  }, [activeGuidance, onTextModeChange]);

  // Notify parent about guidance state changes
  useEffect(() => {
    if (onGuidanceStateChange) {
      onGuidanceStateChange(activeGuidance, currentStepIndex);
    }
  }, [activeGuidance, currentStepIndex, onGuidanceStateChange]);

  // Auto-scroll to bottom when new messages are displayed
  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  // Audio and video synchronization
  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleAudioPlaying = () => {
      setIsAudioPlaying(true);
      
      if (videoRef.current && video.paused) {
        video.currentTime = 10;
        video.play().catch(err => {
          if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
            // Suppress non-debug logs
          }
        });
      }
    };
    
    const handleAudioPause = () => {
      setIsAudioPlaying(false);
    };
    
    const handleAudioEnded = () => {
      setIsAudioPlaying(false);
    };
    
    const handleVideoTimeUpdate = () => {
      if (video.currentTime >= 20) {
        video.currentTime = 10;
      }
      
      if (video.currentTime >= 9.9 && !isAudioPlaying) {
        video.currentTime = 0;
      }
      
      if (isAudioPlaying && video.currentTime < 10) {
        video.currentTime = 10;
      }
    };
    
    audio.addEventListener('playing', handleAudioPlaying);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    return () => {
      audio.removeEventListener('playing', handleAudioPlaying);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleAudioEnded);
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
    };
  }, [videoRef.current, audioRef.current, isAudioPlaying]);

  const playAudioSegment = (audioName: string, stepIndex: number) => {
    if (!audioRef.current) return;
    
    const audioPath = `/audio/${worksheetId}/${audioName}_${stepIndex + 1}.mp3`;
    
    audioRef.current.src = audioPath;
    
    audioRef.current.onerror = () => {
      setIsAudioPlaying(false);
    };
    
    audioRef.current.play().catch(err => {
      setIsAudioPlaying(false);
    });
  };

  const handleGuidanceClick = (guidance: GuidanceItem) => {
    if (!guidance.description || guidance.description.length === 0) {
      return;
    }
    
    setActiveGuidance(guidance);
    setCurrentStepIndex(0);
    setDisplayedMessages([guidance.description[0]]);
    
    if (videoRef.current && audioAvailable) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
          // Suppress non-debug logs
        }
      });
    }
    
    if (audioAvailable) {
      setTimeout(() => {
        playAudioSegment(guidance.audioName, 0);
      }, 500);
    }
  };

  const handleNextStep = () => {
    if (activeGuidance && activeGuidance.description && currentStepIndex < activeGuidance.description.length - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        activeGuidance.description[nextStepIndex]
      ]);
      
      if (audioAvailable) {
        setTimeout(() => {
          playAudioSegment(activeGuidance.audioName, nextStepIndex);
        }, 500);
      }
    }
  };

  const handleBackToTitles = () => {
    setActiveGuidance(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setIsAudioPlaying(false);
  };

  const handleMessageClick = (index: number) => {
    if (!activeGuidance || !audioAvailable) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    playAudioSegment(activeGuidance.audioName, index);
    
    const messageElement = document.querySelector(`[data-message-index="${index}"]`);
    if (messageElement) {
      messageElement.classList.add('message-highlight');
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 200);
    }
  };

  const handleTutorSelected = (videoUrl: string) => {
    setSelectedTutorVideoUrl(videoUrl);
    localStorage.setItem('selectedVirtualTutor', videoUrl);
    setShowTutorSelectionModal(false);
    
    if (videoRef.current) {
      videoRef.current.load();
      if (isAudioPlaying) {
        videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
            // Suppress non-debug logs
          }
        });
      }
    }
  };

  const handleVideoContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const hasNextStep = activeGuidance?.description && currentStepIndex < activeGuidance.description.length - 1;

  if (activeGuidance) {
    // Text mode - showing guidance description
    return (
      <div className="worksheet-container text-mode">
        <audio ref={audioRef} className="hidden" />
        
        <Button
          onClick={handleBackToTitles}
          className="fixed top-4 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
          size="icon"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        {audioAvailable && (
          <Button
            onClick={() => setShowTutorSelectionModal(true)}
            className="fixed top-24 right-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg h-8 w-8"
            aria-label="Select Virtual Tutor"
          >
            <UserRound className="h-4 w-4" />
          </Button>
        )}
        
        <div className="worksheet-text-display-container active">
          {audioAvailable && (
            <video 
              ref={videoRef}
              className="video-element"
              src={selectedTutorVideoUrl}
              muted
              autoPlay
              playsInline
              preload="auto"
              onContextMenu={handleVideoContextMenu}
            />
          )}
          
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <div className="text-content chat-messages">
              {displayedMessages.map((message, index) => (
                <div 
                  key={index} 
                  className="chat-message"
                  onClick={() => handleMessageClick(index)}
                  data-message-index={index}
                  role="button"
                  tabIndex={0}
                  dir={getTextDirection(message)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleMessageClick(index);
                    }
                  }}
                >
                  <p>{message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasNextStep && (
          <Button 
            onClick={handleNextStep} 
            className="next-button"
            variant="default"
          >
            <Sparkles className="!h-6 !w-6" />
          </Button>
        )}
        
        <VirtualTutorSelectionModal
          isOpen={showTutorSelectionModal}
          onClose={() => setShowTutorSelectionModal(false)}
          onSelectTutor={handleTutorSelected}
        />
      </div>
    );
  }

  // Main view - showing page description and guidance titles
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Guidance Titles */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Page {autoModePageData.page_number}
          </h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('common.language') === 'العربية' ? 'التوجيهات' : 'Guidance'}
          </h2>
          {autoModePageData.guidance.map((guidance, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-blue-50 border-2 border-transparent hover:border-blue-200"
              onClick={() => handleGuidanceClick(guidance)}
            >
              <h3 className="text-lg font-medium text-gray-900" dir={getTextDirection(guidance.title)}>
                {guidance.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutoModeContentDisplay;