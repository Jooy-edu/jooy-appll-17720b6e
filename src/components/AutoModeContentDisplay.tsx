import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Sparkles, UserRound, Send, MessageCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import ApiKeyManager from "./ApiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useToast } from "@/hooks/use-toast";
import type { AutoModePageData, GuidanceItem } from "@/types/worksheet";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
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
  const { toast } = useToast();
  
  const [activeGuidance, setActiveGuidance] = useState<GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  
  // Chat panel states
  const [showChatPanel, setShowChatPanel] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(true);
  const [showApiKeyManager, setShowApiKeyManager] = useState<boolean>(false);
  
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
    } else if (activeGuidance && activeGuidance.description && currentStepIndex === activeGuidance.description.length - 1) {
      // User has reached the final step, show chat panel
      initializeChatPanel();
    }
  };

  const handleBackToTitles = () => {
    setActiveGuidance(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    setShowChatPanel(false);
    setChatMessages([]);
    
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
  const isLastStep = activeGuidance?.description && currentStepIndex === activeGuidance.description.length - 1;

  // Chat initialization function
  const initializeChatPanel = () => {
    if (!activeGuidance || !activeGuidance.description) return;
    
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `📚 الدرس: ${autoModePageData.page_number} - ${activeGuidance.title}\n\n✅ تم إكمال جميع الخطوات التوجيهية`,
      timestamp: new Date()
    };
    
    // Convert guidance steps to chat messages
    const guidanceMessages: ChatMessage[] = activeGuidance.description.map((message, index) => ({
      role: 'system' as const,
      content: `**الخطوة ${index + 1}:** ${message}`,
      timestamp: new Date()
    }));

    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: 'تم إكمال الخطوات التوجيهية! 🎉\n\nكيف يمكنني مساعدتك الآن؟ يمكنك سؤالي عن:\n• توضيح أي خطوة من الخطوات\n• معلومات إضافية حول الموضوع\n• أمثلة أكثر\n• أي سؤال آخر متعلق بالدرس',
      timestamp: new Date()
    };
    
    setChatMessages([systemMessage, ...guidanceMessages, welcomeMessage]);
    
    // Add smooth animation delay
    setTimeout(() => setShowChatPanel(true), 300);
  };

  // Chat functionality
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setShowApiKeyManager(true);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoadingChat(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Create context from worksheet and guidance
      const context = `
        Worksheet Page: ${pageNumber}
        Guidance Topic: ${activeGuidance?.title || 'Learning guidance'}
        Previous guidance steps: ${activeGuidance?.description?.join('\n') || ''}
      `;

      const chatHistory = chatMessages
        .filter(msg => msg.role === 'user')
        .map(msg => `User: ${msg.content}`)
        .join('\n');

      const prompt = `${context}\n\nPrevious conversation:\n${chatHistory}\n\nUser question: ${userMessage.content}\n\nPlease provide a helpful response in the same language as the user's question.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.text(),
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  };

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

        {(hasNextStep || isLastStep) && (
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

        {/* Enhanced Chat Panel */}
        {showChatPanel && (
          <div className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-2xl z-50 transition-all duration-500 ease-out ${isChatExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-5rem)]'}`}>
            {/* Enhanced Chat Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/50 cursor-pointer hover:bg-gradient-to-r hover:from-primary/15 hover:to-accent/15 transition-colors duration-200" onClick={() => setIsChatExpanded(!isChatExpanded)}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">المساعد الذكي</h3>
                  <span className="text-xs text-muted-foreground bg-accent/20 px-2 py-0.5 rounded-full">
                    متصل بالدرس
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-full">
                  {isChatExpanded ? 'إخفاء' : 'توسيع'}
                </div>
                {isChatExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChatPanel(false);
                  }}
                  className="hover:bg-destructive/20 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Enhanced Chat Messages */}
            {isChatExpanded && (
              <div className="h-96 flex flex-col animate-fade-in">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-card/20 to-background/50">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-scale-in`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground ml-4 border border-primary/20'
                            : message.role === 'system'
                            ? 'bg-accent/20 border border-accent/40 mr-4 text-accent-foreground'
                            : 'bg-card mr-4 border border-border/50 text-card-foreground'
                        }`}
                        dir={getTextDirection(message.content)}
                      >
                        {message.role === 'system' && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-accent/30">
                            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-accent-foreground/80">خطوة التوجيه</span>
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                        <div className="text-xs opacity-60 mt-2">
                          {message.timestamp.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoadingChat && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-card border border-border/50 rounded-xl p-4 mr-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                          <span className="text-sm text-muted-foreground font-medium">المساعد يكتب...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Chat Input */}
                <div className="border-t border-border/50 p-4 bg-gradient-to-r from-background/50 to-card/30">
                  <div className="flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="اكتب سؤالك هنا..."
                      className="flex-1 border-accent/30 focus:border-accent bg-background/70 backdrop-blur-sm transition-all duration-200 focus:shadow-md"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={isLoadingChat}
                      dir="auto"
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={isLoadingChat || !inputMessage.trim()}
                      size="icon"
                      className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 shadow-md"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Key Manager */}
        <ApiKeyManager
          isOpen={showApiKeyManager}
          onClose={() => setShowApiKeyManager(false)}
          onApiKeySet={() => {
            setShowApiKeyManager(false);
            // Retry sending message after API key is set
            if (inputMessage.trim()) {
              sendMessage();
            }
          }}
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