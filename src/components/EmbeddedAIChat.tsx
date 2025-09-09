import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, User, Bot } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { getTextDirection } from "@/lib/textDirection";
import type { WorksheetMetadata, GuidanceItem, AutoModePageData } from "@/types/worksheet";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EmbeddedAIChatProps {
  worksheetData: {
    meta: WorksheetMetadata;
    pdfUrl: string;
  };
  guidance: GuidanceItem;
  pageData: AutoModePageData;
}

const EmbeddedAIChat: React.FC<EmbeddedAIChatProps> = ({
  worksheetData,
  guidance,
  pageData
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat with contextual system message
  useEffect(() => {
    // Build detailed context for the AI
    const contextString = `You are an AI assistant helping a student. Please use the following context to answer their questions.

Page Context: ${pageData.page_description}

Topic Title: ${guidance.title}

Lesson Details:
${guidance.description.map((step, index) => `- ${step}`).join('\n')}

The student has just finished this lesson. Now, answer their questions. Always respond in the same language as the lesson content. If the student asks for specific answers to worksheet exercises, guide them with hints and leading questions rather than giving direct answers. If they ask conceptual questions for understanding, provide clear explanations.`;

    setMessages([
      {
        role: 'system',
        content: contextString
      },
      {
        role: 'assistant',
        content: t('aiChat.welcome')
      }
    ]);
  }, [guidance, pageData, t]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const apiKey = localStorage.getItem('gemini-api-key');
    if (!apiKey) {
      toast({
        title: t('aiChat.apiKeyMissing'),
        description: "Please set up your Gemini API key in the settings to use AI chat.",
        variant: "destructive"
      });
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

      // Prepare conversation for API (exclude system message from API call)
      const conversationForAPI = newMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // Get the system context (first message)
      const systemContext = messages.find(msg => msg.role === 'system')?.content || '';

      const prompt = `${systemContext}

Previous conversation:
${conversationForAPI}

Current question: ${userMessage}

Analyze the student's question carefully. Respond in the same language as the lesson content.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiResponse = response.text();

      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
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
    <div className="bg-white rounded-lg shadow-sm border mt-6">
      {/* Chat Header */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          {t('aiChat.title')}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Ask questions about the lesson you just completed
        </p>
      </div>

      {/* Messages Container */}
      <div className="h-96">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {messages
              .filter(msg => msg.role !== 'system') // Don't display system messages
              .map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'user' ? (
                    // User message - gradient bubble on the right
                    <div 
                      className="max-w-[80%] bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl px-4 py-3 shadow-sm"
                      dir={getTextDirection(message.content)}
                    >
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    // AI message - full width, no bubble
                    <div className="w-full">
                      <div 
                        className="text-gray-800 leading-relaxed text-sm"
                        dir={getTextDirection(message.content)}
                      >
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-em:text-gray-800 prose-code:bg-gray-100 prose-code:text-gray-900 prose-pre:bg-gray-100 prose-pre:text-gray-900 prose-li:text-gray-800 prose-a:text-blue-600 prose-blockquote:text-gray-700 prose-blockquote:border-gray-300"
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-medium mb-2">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-gray-800">{children}</li>,
                            code: ({ children, ...props }) => {
                              const isInline = !props.className;
                              return isInline ? (
                                <code className="bg-gray-100 text-gray-900 px-1 py-0.5 rounded text-xs font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code {...props} className="block bg-gray-100 text-gray-900 p-2 rounded text-xs font-mono overflow-x-auto">
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Container */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('aiChat.typeMessage')}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            size="icon"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmbeddedAIChat;