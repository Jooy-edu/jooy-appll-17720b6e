import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { validateParentalPin, setSessionValidated } from '@/utils/parentalControls';

interface ParentalPinDialogProps {
  open: boolean;
  onValidated: () => void;
  onCancel: () => void;
}

export const ParentalPinDialog: React.FC<ParentalPinDialogProps> = ({
  open,
  onValidated,
  onCancel
}) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  const [error, setError] = useState('');

  const maxAttempts = 3;
  const lockDuration = 30; // seconds

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLocked && lockTimeRemaining > 0) {
      interval = setInterval(() => {
        setLockTimeRemaining(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLocked, lockTimeRemaining]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) return;
    
    if (!pin.trim()) {
      setError(t('parentalControls.enterPin'));
      return;
    }

    if (validateParentalPin(pin)) {
      setSessionValidated();
      setPin('');
      setError('');
      setAttempts(0);
      onValidated();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      
      if (newAttempts >= maxAttempts) {
        setIsLocked(true);
        setLockTimeRemaining(lockDuration);
        setError(t('parentalControls.tooManyAttempts', { seconds: lockDuration }));
      } else {
        setError(t('parentalControls.incorrectPin', { 
          remaining: maxAttempts - newAttempts 
        }));
      }
    }
  };

  const handleCancel = () => {
    setPin('');
    setError('');
    onCancel();
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setPin(numericValue);
    if (error) setError('');
  };

  const isRTL = t('common.language') === 'العربية';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('parentalControls.enterPinTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('parentalControls.enterPinDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">{t('parentalControls.pinCode')}</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••"
              disabled={isLocked}
              className="text-center text-lg tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {isLocked && (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                {t('parentalControls.tryAgainIn', { seconds: lockTimeRemaining })}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLocked || !pin.trim()}
              className="flex-1"
            >
              {t('parentalControls.verify')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLocked}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};