import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Sparkles, UserRound, Send } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AutoModePageData, GuidanceItem } from "@/types/worksheet";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AutoModeContentDisplayProps {
  worksheetId: string;
  pageNumber: number;
  autoModePageData: AutoModePageData;
  pdfUrl: string;
  onTextModeChange?: (isTextMode: boolean) => void;
  onGuidanceStateChange?: (guidance: GuidanceItem | null, stepIndex: number) => void;
  initialActiveGuidance?: GuidanceItem | null;
  initialGuidanceStepIndex?: number;
  allGuidanceState?: Record<number, { currentStepIndex: number }>;
}

const AutoModeContentDisplay: React.FC<AutoModeContentDisplayProps> = ({
  worksheetId,
  pageNumber,
  autoModePageData,
  pdfUrl,
  onTextModeChange,
  onGuidanceStateChange,
  initialActiveGuidance,
  initialGuidanceStepIndex = 0,
  allGuidanceState = {}
}) => {
  const { t } = useTranslation();
  
  const [activeGuidance, setActiveGuidance] = useState<GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  const [showChatBox, setShowChatBox] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  
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
      console.log('🎵 [AUTO MODE] Starting audio availability check');
      const firstGuidance = autoModePageData.guidance[0];
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

  // Auto-initialize chat when final step is reached
  useEffect(() => {
    if (activeGuidance && activeGuidance.description && 
        currentStepIndex === activeGuidance.description.length - 1 && 
        !showChatBox) {
      initializeChatWithGuidance();
    }
  }, [activeGuidance, currentStepIndex, showChatBox]);

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
    }
  };

  const handleBackToTitles = () => {
    setActiveGuidance(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    setShowChatBox(false);
    setChatMessages([]);
    setInputMessage("");
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setIsAudioPlaying(false);
  };

  const initializeChatWithGuidance = () => {
    if (!activeGuidance) return;
    
    const guidanceMessages: ChatMessage[] = displayedMessages.map(message => ({
      role: 'assistant' as const,
      content: message
    }));
    
    setChatMessages(guidanceMessages);
    setShowChatBox(true);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoadingChat) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage("");
    
    // Add user message
    const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setIsLoadingChat(true);
    
    try {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        throw new Error('No API key found. Please set your Gemini API key.');
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // Build context
      const context = `You are an AI tutor helping with worksheet content. 
      
Current worksheet page: ${autoModePageData.page_number}
Page description: ${autoModePageData.page_description}
Current guidance topic: ${activeGuidance?.title || 'General guidance'}

Previous guidance steps shown:
${displayedMessages.map((msg, idx) => `${idx + 1}. ${msg}`).join('\n')}

Please provide helpful, concise responses related to this educational content.`;
      
      const conversation = chatMessages.map(msg => 
        `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`
      ).join('\n');
      
      const prompt = `${context}\n\nConversation so far:\n${conversation}\nStudent: ${userMessage}\nTutor:`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const assistantMessage: ChatMessage = { role: 'assistant', content: text };
      setChatMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please check your API key or try again.' 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingChat(false);
    }
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
  const isLastStep = activeGuidance?.description && currentStepIndex === activeGuidance.description.length - 1;

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

        {hasNextStep && !showChatBox && (
          <Button 
            onClick={handleNextStep} 
            className="next-button"
            variant="default"
          >
            <Sparkles className="!h-6 !w-6" />
          </Button>
        )}

        {showChatBox && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-h-96 flex flex-col">
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.role === 'user' 
                      ? 'bg-blue-100 ml-8 text-right' 
                      : 'bg-gray-100 mr-8'
                  }`}
                  dir={getTextDirection(message.content)}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              ))}
              {isLoadingChat && (
                <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Thinking...</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                dir={getTextDirection(inputMessage)}
              />
              <Button 
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoadingChat}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
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