import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles, UserRound, MessageSquare, ArrowUpDown, Volume2 } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import EmbeddedAIChat from "./EmbeddedAIChat";
import type { AutoModePageData, GuidanceItem, WorksheetMetadata } from "@/types/worksheet";
import { ParentalPinDialog } from "./ParentalPinDialog";
import { ParentalPinSetupDialog } from "./ParentalPinSetupDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import {
  isFirstTimeSetup,
  shouldShowPinPrompt,
  setSessionValidated
} from "@/utils/parentalControls";

interface AutoModeContentDisplayProps {
  worksheetId: string;
  pageNumber: number;
  autoModePageData: AutoModePageData;
  worksheetData: {
    meta: WorksheetMetadata;
    pdfUrl: string;
  };
  pdfUrl: string;
  onTextModeChange?: (isTextMode: boolean) => void;
  onGuidanceStateChange?: (guidance: GuidanceItem | null, stepIndex: number) => void;
  onEmbeddedChatChange?: (showChat: boolean) => void;
  initialActiveGuidance?: GuidanceItem | null;
  initialGuidanceStepIndex?: number;
  allGuidanceState?: Record<number, { currentStepIndex: number }>;
  showEmbeddedChat?: boolean;
}

const AutoModeContentDisplay: React.FC<AutoModeContentDisplayProps> = ({
  worksheetId,
  pageNumber,
  autoModePageData,
  worksheetData,
  pdfUrl,
  onTextModeChange,
  onGuidanceStateChange,
  onEmbeddedChatChange,
  initialActiveGuidance,
  initialGuidanceStepIndex = 0,
  allGuidanceState = {},
  showEmbeddedChat = false
}) => {
  const { t } = useTranslation();
  
  const [activeGuidance, setActiveGuidance] = useState<GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  
  // Guidance mode state (student or parent)
  const [guidanceMode, setGuidanceMode] = useState<'student' | 'parent'>(() => {
    const stored = sessionStorage.getItem(`guidanceMode_${worksheetId}_${pageNumber}`);
    return (stored as 'student' | 'parent') || 'student';
  });
  
  // Virtual tutor selection state
  const [selectedTutorVideoUrl, setSelectedTutorVideoUrl] = useState<string>(() => {
    return localStorage.getItem('selectedVirtualTutor') || '/video/1.mp4';
  });
  const [showTutorSelectionModal, setShowTutorSelectionModal] = useState<boolean>(false);
  
  // Parental controls state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showPinSetupDialog, setShowPinSetupDialog] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<'parent' | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Determine if parent guidance exists (check both parent_guidance and parentGuidance for compatibility)
  const hasParentGuidance = autoModePageData && (
    (autoModePageData.parent_guidance && autoModePageData.parent_guidance.length > 0) ||
    (autoModePageData.parentGuidance && autoModePageData.parentGuidance.length > 0)
  );
  
  // Debug logging
  console.log('AutoModeContentDisplay Debug:', {
    autoModePageData,
    hasParentGuidance,
    parentGuidanceLength: autoModePageData?.parent_guidance?.length,
    guidanceLength: autoModePageData?.guidance?.length,
    guidanceMode,
    worksheetId,
    pageNumber
  });

  // Get current guidance array based on mode
  const currentGuidance = guidanceMode === 'parent' && autoModePageData.parent_guidance 
    ? autoModePageData.parent_guidance 
    : autoModePageData.guidance;

  // Save guidance mode to session storage
  useEffect(() => {
    sessionStorage.setItem(`guidanceMode_${worksheetId}_${pageNumber}`, guidanceMode);
  }, [guidanceMode, worksheetId, pageNumber]);

  // Initial audio availability check
  useEffect(() => {
    if (!audioCheckPerformed && currentGuidance.length > 0) {
      console.log('🎵 [AUTO MODE] Starting audio availability check');
      const firstGuidance = currentGuidance[0];
      if (!firstGuidance || !firstGuidance.audioName) {
        console.log('🎵 [AUTO MODE] No first guidance or audioName found, marking audio unavailable');
        setAudioAvailable(false);
        setAudioCheckPerformed(true);
        return;
      }
      
      const audioPath = `/audio/${worksheetId}/${firstGuidance.audioName}_1.mp3`;
      console.log('🎵 [AUTO MODE] Testing audio path:', audioPath);
      
      const testAudio = new Audio();
      let checkCompleted = false;
      
      const completeCheck = (available: boolean) => {
        if (checkCompleted) return;
        checkCompleted = true;
        
        console.log('🎵 [AUTO MODE] Audio availability check result:', available);
        setAudioAvailable(available);
        setAudioCheckPerformed(true);
        
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
      };
      
      const handleCanPlay = () => {
        console.log('🎵 [AUTO MODE] Audio can play');
        completeCheck(true);
      };
      
      const handleError = (e: any) => {
        console.error('🎵 [AUTO MODE] Audio error during check:', e);
        completeCheck(false);
      };
      
      testAudio.addEventListener('canplaythrough', handleCanPlay);
      testAudio.addEventListener('error', handleError);
      
      const timeout = setTimeout(() => {
        console.log('🎵 [AUTO MODE] Audio check timeout');
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
  }, [worksheetId, currentGuidance, audioCheckPerformed]);

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

  // Initialize guidance state from props if available
  useEffect(() => {
    if (initialActiveGuidance && initialGuidanceStepIndex >= 0) {
      setActiveGuidance(initialActiveGuidance);
      setCurrentStepIndex(initialGuidanceStepIndex);
      if (initialActiveGuidance.description) {
        const messages = initialActiveGuidance.description.slice(0, initialGuidanceStepIndex + 1);
        setDisplayedMessages(messages);
        
        // Check if we should show embedded chat based on initial state
        if (initialGuidanceStepIndex >= initialActiveGuidance.description.length - 1) {
          console.log('🔍 [DEBUG] Initial state shows final step, triggering embedded chat');
          if (onEmbeddedChatChange) {
            onEmbeddedChatChange(true);
          }
        }
      }
    }
  }, [initialActiveGuidance, initialGuidanceStepIndex, onEmbeddedChatChange]);

  const playAudioSegment = (audioName: string, stepIndex: number) => {
    console.log('🎵 [AUTO MODE] Attempting to play audio:', audioName, 'step:', stepIndex);
    if (!audioRef.current) {
      console.log('🎵 [AUTO MODE] No audio ref available');
      return;
    }
    
    if (!audioName) {
      console.warn('🎵 [AUTO MODE] No audioName provided');
      return;
    }
    
    const audioPath = `/audio/${worksheetId}/${audioName}_${stepIndex + 1}.mp3`;
    console.log('🎵 [AUTO MODE] Audio path:', audioPath);
    
    audioRef.current.src = audioPath;
    
    audioRef.current.onerror = (e) => {
      console.error('🎵 [AUTO MODE] Audio error:', e);
      setIsAudioPlaying(false);
    };
    
    audioRef.current.play().catch(err => {
      console.error('🎵 [AUTO MODE] Audio play error:', err);
      setIsAudioPlaying(false);
    });
  };

  const handleGuidanceClick = (guidance: GuidanceItem) => {
    console.log('🎯 [AUTO MODE] Guidance clicked:', guidance.title, 'audioName:', guidance.audioName);
    
    if (!guidance.description || guidance.description.length === 0) {
      console.warn('🎯 [AUTO MODE] No description for guidance:', guidance.title);
      return;
    }
    
    setActiveGuidance(guidance);
    setCurrentStepIndex(0);
    setDisplayedMessages([guidance.description[0]]);
    
    if (videoRef.current && audioAvailable) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
          console.error('🎥 [AUTO MODE] Video play error:', err);
        }
      });
    }
    
    if (audioAvailable && guidance.audioName) {
      setTimeout(() => {
        playAudioSegment(guidance.audioName, 0);
      }, 500);
    } else if (!guidance.audioName) {
      console.warn('🎵 [AUTO MODE] No audioName found for guidance:', guidance.title);
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
    } else if (activeGuidance && currentStepIndex >= activeGuidance.description.length - 1) {
      // We've reached the final step, show embedded chat
      console.log('🔍 [DEBUG] Final step reached, showing embedded chat');
      if (onEmbeddedChatChange) {
        onEmbeddedChatChange(true);
      }
    }
  };

  const handleBackToTitles = () => {
    setActiveGuidance(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    if (onEmbeddedChatChange) {
      onEmbeddedChatChange(false);
    }
    
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

  const handleGuidanceModeToggle = () => {
    const newMode = guidanceMode === 'student' ? 'parent' : 'student';
    
    if (newMode === 'parent') {
      // Check if PIN protection is needed
      if (isFirstTimeSetup()) {
        setPendingModeSwitch('parent');
        setShowPinSetupDialog(true);
        return;
      } else if (shouldShowPinPrompt()) {
        setPendingModeSwitch('parent');
        setShowPinDialog(true);
        return;
      }
    }
    
    // Switch immediately if no PIN protection needed
    switchGuidanceMode(newMode);
  };

  const switchGuidanceMode = (newMode: 'student' | 'parent') => {
    setGuidanceMode(newMode);
    
    // Reset active guidance when switching modes
    setActiveGuidance(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    if (onEmbeddedChatChange) {
      onEmbeddedChatChange(false);
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setIsAudioPlaying(false);
  };

  const handlePinValidated = () => {
    setShowPinDialog(false);
    if (pendingModeSwitch) {
      switchGuidanceMode(pendingModeSwitch);
      setPendingModeSwitch(null);
    }
  };

  const handlePinDialogCancel = () => {
    setShowPinDialog(false);
    setPendingModeSwitch(null);
  };

  const handlePinSetupCompleted = () => {
    setShowPinSetupDialog(false);
    if (pendingModeSwitch) {
      switchGuidanceMode(pendingModeSwitch);
      setPendingModeSwitch(null);
    }
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
              
              {/* Embedded Chat integrated within the guidance steps */}
              {showEmbeddedChat && activeGuidance && (
                <div className="mt-4">
                  <EmbeddedAIChat
                    worksheetData={worksheetData}
                    guidance={activeGuidance}
                    pageData={autoModePageData}
                    inline={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {hasNextStep ? (
          <Button 
            onClick={handleNextStep} 
            className="next-button"
            variant="default"
          >
            <Sparkles className="!h-6 !w-6" />
          </Button>
        ) : activeGuidance && !showEmbeddedChat && (
          <Button 
            onClick={() => {
              console.log('🔍 [DEBUG] Complete lesson button clicked, triggering embedded chat');
              console.log('🔍 [DEBUG] Current showEmbeddedChat state:', showEmbeddedChat);
              onEmbeddedChatChange(true);
            }} 
            className="next-button z-[80]"
            variant="default"
          >
            <MessageSquare className="!h-6 !w-6" />
          </Button>
        )}

        
        <VirtualTutorSelectionModal
          isOpen={showTutorSelectionModal}
          onClose={() => setShowTutorSelectionModal(false)}
          onSelectTutor={handleTutorSelected}
        />

        <ParentalPinDialog
          open={showPinDialog}
          onValidated={handlePinValidated}
          onCancel={handlePinDialogCancel}
        />

        <ParentalPinSetupDialog
          open={showPinSetupDialog}
          onCompleted={handlePinSetupCompleted}
        />
      </div>
    );
  }

  // Main view - showing page description and guidance titles
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Guidance Mode Switch Button - Always show in auto mode */}
        <div className="flex justify-center mt-4 mb-6">
          <Button
            onClick={handleGuidanceModeToggle}
            variant="outline"
            className="flex items-center gap-2 bg-white border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span dir={getTextDirection(t('common.language'))}>
              {guidanceMode === 'student' 
                ? (t('common.language') === 'العربية' ? 'دليل الوالدين' : 'Parent Guidance')
                : (t('common.language') === 'العربية' ? 'دليل الطالب' : 'Student Guidance')
              }
            </span>
          </Button>
        </div>

        {/* Guidance Titles with Accordion */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Page {autoModePageData.page_number}
          </h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {guidanceMode === 'parent' 
              ? (t('common.language') === 'العربية' ? 'دليل الوالدين' : 'Parent Guidance')
              : (t('common.language') === 'العربية' ? 'التوجيهات' : 'Student Guidance')
            }
          </h2>
          {currentGuidance && currentGuidance.length > 0 ? (
            <div className="space-y-3">
              <Accordion 
                type="single" 
                collapsible 
                className="w-full space-y-4"
                defaultValue="guidance-0"
              >
                {currentGuidance.map((guidance, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`guidance-${index}`}
                    className="bg-white rounded-xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-300 overflow-hidden"
                  >
                    <AccordionTrigger 
                      className="px-6 py-5 hover:no-underline text-left bg-gradient-to-r from-gray-50 to-blue-50 hover:from-blue-50 hover:to-purple-50 transition-all duration-300 group [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-blue-100 [&[data-state=open]]:to-purple-100"
                      dir={getTextDirection(guidance.title)}
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="flex-1">
                          <ReactMarkdown className="text-lg font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-200 prose prose-sm max-w-none [&>p]:mb-0">
                            {guidance.title}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2">
                          {audioAvailable && guidance.audioName && (
                            <div className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded-full">
                              <Volume2 className="h-3 w-3 text-blue-600" />
                              <span className="text-xs text-blue-600 font-medium">Audio</span>
                            </div>
                          )}
                          <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center group-hover:bg-blue-300 transition-colors duration-200">
                            <span className="text-xs font-bold text-blue-700">{index + 1}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 bg-white">
                      <div className="space-y-4 pt-2">
                        {guidance.description && guidance.description.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-400">
                            <div className="text-gray-700 leading-relaxed" dir={getTextDirection(guidance.description[0])}>
                              <ReactMarkdown className="prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                                {guidance.description[0]}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                        <Button
                          onClick={() => handleGuidanceClick(guidance)}
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 py-3 text-base font-semibold rounded-lg"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            {t('common.language') === 'العربية' ? 'ابدأ التعلم' : 'Start Learning'}
                          </span>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-gray-500" dir={getTextDirection(t('common.language'))}>
                {guidanceMode === 'parent' 
                  ? (t('common.language') === 'العربية' ? 'لا يوجد دليل للوالدين متاح لهذه الصفحة' : 'No parent guidance available for this page.')
                  : (t('common.language') === 'العربية' ? 'لا يوجد دليل للطالب متاح لهذه الصفحة' : 'No student guidance available for this page.')
                }
              </p>
            </div>
          )}
        </div>

        {/* Embedded Chat on Main Page - shown after any lesson completion */}
        {showEmbeddedChat && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('common.language') === 'العربية' ? 'اسأل عن هذه الصفحة' : 'Ask about this page'}
              </h3>
              <EmbeddedAIChat
                worksheetData={worksheetData}
                guidance={null}
                pageData={autoModePageData}
              />
            </div>
          </div>
        )}

        <ParentalPinDialog
          open={showPinDialog}
          onValidated={handlePinValidated}
          onCancel={handlePinDialogCancel}
        />

        <ParentalPinSetupDialog
          open={showPinSetupDialog}
          onCompleted={handlePinSetupCompleted}
        />
      </div>
    </div>
  );
};

export default AutoModeContentDisplay;