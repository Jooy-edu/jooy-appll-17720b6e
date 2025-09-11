import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Lock, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setParentalPin, skipPinProtection, setSessionValidated } from '@/utils/parentalControls';

interface ParentalPinSetupDialogProps {
  open: boolean;
  onCompleted: () => void;
}

export const ParentalPinSetupDialog: React.FC<ParentalPinSetupDialogProps> = ({
  open,
  onCompleted
}) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'intro' | 'setup'>('intro');

  const handleSetup = () => {
    setStep('setup');
  };

  const handleSkip = () => {
    skipPinProtection();
    onCompleted();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setError(t('parentalControls.enterPin'));
      return;
    }

    if (pin.length < 4) {
      setError(t('parentalControls.pinTooShort'));
      return;
    }

    if (pin !== confirmPin) {
      setError(t('parentalControls.pinsDoNotMatch'));
      return;
    }

    if (setParentalPin(pin)) {
      setSessionValidated();
      onCompleted();
    } else {
      setError(t('parentalControls.setupError'));
    }
  };

  const handlePinChange = (value: string, isConfirm = false) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    if (isConfirm) {
      setConfirmPin(numericValue);
    } else {
      setPin(numericValue);
    }
    if (error) setError('');
  };

  const isRTL = t('common.language') === 'العربية';

  if (step === 'intro') {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('parentalControls.setupTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('parentalControls.setupDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">{t('parentalControls.whySetupPin')}</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• {t('parentalControls.protectContent')}</li>
                <li>• {t('parentalControls.controlAccess')}</li>
                <li>• {t('parentalControls.manageSettings')}</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSetup} className="flex-1">
                <Lock className="mr-2 h-4 w-4" />
                {t('parentalControls.setupPin')}
              </Button>
              <Button variant="outline" onClick={handleSkip}>
                {t('parentalControls.skipForNow')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('parentalControls.createPin')}
          </DialogTitle>
          <DialogDescription>
            {t('parentalControls.createPinDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">{t('parentalControls.newPin')}</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••"
              className="text-center text-lg tracking-widest"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {t('parentalControls.pinRequirement')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">{t('parentalControls.confirmPin')}</Label>
            <Input
              id="confirmPin"
              type="password"
              value={confirmPin}
              onChange={(e) => handlePinChange(e.target.value, true)}
              placeholder="••••"
              className="text-center text-lg tracking-widest"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!pin.trim() || !confirmPin.trim()}
              className="flex-1"
            >
              {t('parentalControls.createPin')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('intro')}
            >
              {t('common.back')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};