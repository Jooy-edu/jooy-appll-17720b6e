import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Key, Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiKeyManagerProps {
  onApiKeySet?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onApiKeySet, isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Get current API key status
  const currentApiKey = localStorage.getItem('gemini-api-key');
  const hasApiKey = !!currentApiKey;

  // Auto-open dialog when isOpen prop changes
  useEffect(() => {
    if (isOpen && !hasApiKey) {
      // Auto-focus and open when needed
    }
  }, [isOpen, hasApiKey]);

  // Simple API key format validation
  const validateApiKeyFormat = (key: string): boolean => {
    // Gemini API keys typically start with "AIza" and are about 39 characters long
    const geminiKeyPattern = /^AIza[0-9A-Za-z-_]{35}$/;
    return geminiKeyPattern.test(key.trim());
  };

  const handleSaveApiKey = async () => {
    const trimmedKey = apiKey.trim();
    
    if (!trimmedKey) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid API key.",
        variant: "destructive"
      });
      return;
    }

    if (!validateApiKeyFormat(trimmedKey)) {
      toast({
        title: "Invalid API Key Format",
        description: "Please ensure you've entered a valid Gemini API key. It should start with 'AIza' and be 39 characters long.",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);

    try {
      // Test the API key by making a simple request
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(trimmedKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      // Make a minimal test request
      const result = await model.generateContent("Test");
      await result.response.text(); // This will throw if the key is invalid
      
      // If we reach here, the key is valid
      localStorage.setItem('gemini-api-key', trimmedKey);
      
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been validated and saved successfully.",
      });

      setApiKey('');
      onClose?.();
      onApiKeySet?.();
      
    } catch (error: any) {
      console.error('API key validation failed:', error);
      
      let errorMessage = "The API key appears to be invalid or expired.";
      
      if (error?.message?.includes('API_KEY_INVALID')) {
        errorMessage = "The API key is invalid. Please check your key and try again.";
      } else if (error?.message?.includes('quota')) {
        errorMessage = "API quota exceeded. Please check your Google AI Studio billing.";
      } else if (error?.message?.includes('permission')) {
        errorMessage = "Permission denied. Please ensure the API key has proper permissions.";
      }
      
      toast({
        title: "API Key Validation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveApiKey = () => {
    localStorage.removeItem('gemini-api-key');
    toast({
      title: "API Key Removed",
      description: "Your Gemini API key has been removed from this device.",
    });
    onClose?.();
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gemini API Key Management
          </DialogTitle>
          <DialogDescription>
            Manage your Google Gemini API key for AI chat functionality.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasApiKey && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Current API Key</CardTitle>
                <CardDescription>
                  {showApiKey ? currentApiKey : maskApiKey(currentApiKey || '')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="gap-2"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showApiKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveApiKey}
                  className="gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <Label htmlFor="apiKey">
              {hasApiKey ? 'Update API Key' : 'Enter New API Key'}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Privacy Notice:</strong> Your API key is stored locally on your device only. 
              It's never sent to our servers - only directly to Google's Gemini API.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim() || isValidating}
              className="w-full"
            >
              {isValidating ? 'Validating...' : hasApiKey ? 'Update API Key' : 'Save API Key'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
              className="w-full gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Get API Key from Google AI Studio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyManager;