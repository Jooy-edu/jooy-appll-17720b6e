import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useActivation } from '@/hooks/useActivation';

interface ActivationCodeInputProps {
  onSuccess: (accessExpiresAt: string) => void;
}

const ActivationCodeInput: React.FC<ActivationCodeInputProps> = ({ onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { activateUser, formatCode, validateCodeFormat, isActivating } = useActivation();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Please enter an activation code');
      return;
    }

    if (!validateCodeFormat(code)) {
      setError('Please enter a valid activation code in XXXX-XXXX-XXXX format');
      return;
    }

    const result = await activateUser(code);
    
    if (result.success && result.accessExpiresAt) {
      onSuccess(result.accessExpiresAt);
    } else {
      setError(result.error || 'Activation failed');
    }
  };

  const isValidFormat = code.length === 0 || validateCodeFormat(code);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="activation-code" className="text-sm font-medium">
          Activation Code
        </Label>
        <Input
          id="activation-code"
          type="text"
          value={code}
          onChange={handleInputChange}
          placeholder="XXXX-XXXX-XXXX"
          className={`text-center text-lg font-mono tracking-wider ${
            !isValidFormat ? 'border-destructive' : ''
          }`}
          maxLength={14}
          disabled={isActivating}
        />
        {code.length > 0 && !isValidFormat && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Please use the format XXXX-XXXX-XXXX
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!validateCodeFormat(code) || isActivating}
        className="w-full"
      >
        {isActivating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Activate Account
          </>
        )}
      </Button>
    </form>
  );
};

export default ActivationCodeInput;