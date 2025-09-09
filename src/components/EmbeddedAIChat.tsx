import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Send, Loader2, Bot } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { getTextDirection } from "@/lib/textDirection";
import ApiKeyManager from "./ApiKeyManager";
import type { AutoModePageData, GuidanceItem } from "@/types/worksheet";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EmbeddedAIChatProps {
  worksheetData: AutoModePageData;
  guidance: GuidanceItem;
  worksheetId: string;
  pageNumber: number;
  onBack: () => void;
}

const EmbeddedAIChat: React.FC<EmbeddedAIChatProps> = ({
  worksheetData,
  guidance,
  worksheetId,
  pageNumber,
  onBack
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat with context
  useEffect(() => {
    const contextString = `You are an AI assistant helping a student. Please use the following context to answer their questions.

Page Context: ${worksheetData.page_description}

Topic Title: ${guidance.title}

Lesson Details:
${guidance.description.map((step, index) => `- ${step}`).join('\n')}

The student has just finished this lesson. Now, answer their questions.`;

    // Load existing chat history or create new one with context
    const chatHistoryKey = `embeddedAiChatHistory_${worksheetId}_${pageNumber}_${guidance.title}`;
    
    try {
      const storedHistory = localStorage.getItem(chatHistoryKey);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setMessages(parsedHistory);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
    
    // Set initial context and welcome message
    setMessages([
      { role: 'system', content: contextString },
      { role: 'assistant', content: t('aiChat.welcome') }
    ]);
  }, [worksheetData, guidance, worksheetId, pageNumber, t]);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    
    const chatHistoryKey = `embeddedAiChatHistory_${worksheetId}_${pageNumber}_${guidance.title}`;
    
    try {
      localStorage.setItem(chatHistoryKey, JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }, [messages, worksheetId, pageNumber, guidance.title]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

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

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    // Add user message to chat
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Prepare conversation for the API (exclude system messages from API call)
      const conversationForAPI = newMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));

      // Get the system context
      const systemMessage = newMessages.find(msg => msg.role === 'system');
      const contextPrompt = systemMessage ? systemMessage.content : '';

      // Create enhanced prompt
      const enhancedPrompt = `${contextPrompt}

IMPORTANT: Always respond in the same language as the user's question and worksheet content.

You must distinguish between two types of student questions:

1. WORKSHEET QUESTIONS: Questions asking for direct answers to specific worksheet problems, exercises, or tasks.
   - For these questions: NEVER give the direct answer. Instead, provide hints, guide the student's thinking process, ask leading questions, or explain the underlying concepts that will help them solve it themselves.
   - Examples: "What's the answer to question 3?", "Fill in the blank for me", "What should I write here?", "What's the correct word?"

2. CONCEPTUAL QUESTIONS: Questions asking for understanding of general concepts, explanations, or clarification that are NOT asking for specific worksheet answers.
   - For these questions: Provide clear, direct explanations and help the student understand the concept fully.
   - Examples: "What is an adjective?", "How do I identify weather patterns?", "Can you explain what this concept means?", "Why does this work this way?"

Current question: ${userMessage}

Analyze the student's question carefully. If they're asking for a specific worksheet answer, guide them without giving the answer. If they're asking to understand a concept, explain it clearly and directly. Be encouraging and educational in both cases.`;

      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const aiResponse = response.text();

      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      console.error('AI Chat Error:', error);
      toast({
        title: t('aiChat.aiError'),
        description: t('aiChat.aiErrorDesc'),
        variant: "destructive"
      });
      
      // Remove the user message if AI failed to respond
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Back Button */}
      <Button
        onClick={onBack}
        className="fixed top-4 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
        size="icon"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-60 bg-white border-b border-gray-200 p-4 flex items-center gap-4">
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
            {t('aiChat.title')} - {guidance.title}
          </h1>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 flex flex-col pt-20 pb-20 max-w-4xl mx-auto w-full">
        {/* Messages Container */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {messages.filter(msg => msg.role !== 'system').map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'user' ? (
                    <div 
                      className="max-w-[80%] bg-gradient-orange-magenta text-white rounded-2xl px-4 py-3 shadow-sm"
                      dir={getTextDirection(message.content)}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-orange-magenta rounded-full flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div 
                          className="flex-1 text-gray-800 leading-relaxed"
                          dir={getTextDirection(message.content)}
                        >
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-em:text-gray-800 prose-code:bg-gray-100 prose-code:text-gray-900 prose-pre:bg-gray-100 prose-pre:text-gray-900 prose-li:text-gray-800 prose-a:text-blue-600 prose-blockquote:text-gray-700 prose-blockquote:border-gray-300"
                            components={{
                              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-4 pl-6">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-4 pl-6">{children}</ol>,
                              li: ({ children }) => <li className="mb-1">{children}</li>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-4">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold mb-3">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-medium mb-2">{children}</h3>,
                              code: ({ children }) => <code className="px-1 py-0.5 rounded text-sm">{children}</code>,
                              pre: ({ children }) => <pre className="p-3 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('aiChat.typing')}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="fixed bottom-0 left-0 right-0 z-60 bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('aiChat.placeholder')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
              dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !inputMessage.trim()}
              className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* API Key Manager Modal */}
      {showApiKeyManager && (
        <ApiKeyManager 
          isOpen={showApiKeyManager}
          onClose={() => setShowApiKeyManager(false)}
          onApiKeySet={() => {
            setShowApiKeyManager(false);
            // Retry sending the message after API key is set
            handleSendMessage();
          }}
        />
      )}
    </div>
  );
};

export default EmbeddedAIChat;