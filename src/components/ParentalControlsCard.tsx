import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, Lock, Unlock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getParentalControlsSettings,
  hasParentalPin,
  isPinProtectionEnabled,
  togglePinProtection,
  removeParentalPin,
  validateParentalPin,
  setParentalPin
} from '@/utils/parentalControls';
import { ParentalPinDialog } from './ParentalPinDialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

export const ParentalControlsCard: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(getParentalControlsSettings());
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<'toggle' | 'remove' | 'change' | null>(null);

  const refreshSettings = () => {
    setSettings(getParentalControlsSettings());
  };

  const handleToggleProtection = (enabled: boolean) => {
    if (enabled && !hasParentalPin()) {
      // Need to set up PIN first
      setShowChangePin(true);
      setPendingAction('toggle');
    } else if (!enabled || hasParentalPin()) {
      // Need PIN verification for disabling or if PIN exists
      setPendingAction('toggle');
      setShowPinDialog(true);
    } else {
      togglePinProtection(enabled);
      refreshSettings();
    }
  };

  const handleRemovePin = () => {
    setPendingAction('remove');
    setShowPinDialog(true);
  };

  const handleChangePin = () => {
    if (hasParentalPin()) {
      setPendingAction('change');
      setShowPinDialog(true);
    } else {
      setShowChangePin(true);
      setPendingAction('change');
    }
  };

  const handlePinValidated = () => {
    setShowPinDialog(false);
    
    switch (pendingAction) {
      case 'toggle':
        togglePinProtection(!settings.isPinProtectionEnabled);
        break;
      case 'remove':
        removeParentalPin();
        break;
      case 'change':
        setShowChangePin(true);
        break;
    }
    
    setPendingAction(null);
    refreshSettings();
  };

  const handlePinDialogCancel = () => {
    setShowPinDialog(false);
    setPendingAction(null);
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (hasParentalPin() && !validateParentalPin(currentPin)) {
      setError(t('parentalControls.incorrectCurrentPin'));
      return;
    }

    if (newPin.length < 4) {
      setError(t('parentalControls.pinTooShort'));
      return;
    }

    if (newPin !== confirmNewPin) {
      setError(t('parentalControls.pinsDoNotMatch'));
      return;
    }

    if (setParentalPin(newPin)) {
      setShowChangePin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setError('');
      setPendingAction(null);
      refreshSettings();
    } else {
      setError(t('parentalControls.setupError'));
    }
  };

  const handlePinChange = (value: string, field: 'current' | 'new' | 'confirm') => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    switch (field) {
      case 'current':
        setCurrentPin(numericValue);
        break;
      case 'new':
        setNewPin(numericValue);
        break;
      case 'confirm':
        setConfirmNewPin(numericValue);
        break;
    }
    if (error) setError('');
  };

  const isRTL = t('common.language') === 'العربية';

  if (showChangePin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
            <Lock className="h-5 w-5" />
            {hasParentalPin() ? t('parentalControls.changePin') : t('parentalControls.setupPin')}
          </CardTitle>
          <CardDescription dir={isRTL ? 'rtl' : 'ltr'}>
            {hasParentalPin() 
              ? t('parentalControls.changePinDescription')
              : t('parentalControls.createPinDescription')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePinSubmit} className="space-y-4">
            {hasParentalPin() && (
              <div className="space-y-2">
                <Label htmlFor="currentPin">{t('parentalControls.currentPin')}</Label>
                <Input
                  id="currentPin"
                  type="password"
                  value={currentPin}
                  onChange={(e) => handlePinChange(e.target.value, 'current')}
                  placeholder="••••"
                  className="text-center text-lg tracking-widest"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPin">{t('parentalControls.newPin')}</Label>
              <Input
                id="newPin"
                type="password"
                value={newPin}
                onChange={(e) => handlePinChange(e.target.value, 'new')}
                placeholder="••••"
                className="text-center text-lg tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPin">{t('parentalControls.confirmPin')}</Label>
              <Input
                id="confirmNewPin"
                type="password"
                value={confirmNewPin}
                onChange={(e) => handlePinChange(e.target.value, 'confirm')}
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
                disabled={
                  !newPin.trim() || 
                  !confirmNewPin.trim() || 
                  (hasParentalPin() && !currentPin.trim())
                }
                className="flex-1"
              >
                {hasParentalPin() ? t('parentalControls.changePin') : t('parentalControls.setupPin')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowChangePin(false);
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                  setError('');
                  setPendingAction(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
            <Shield className="h-5 w-5" />
            {t('parentalControls.title')}
          </CardTitle>
          <CardDescription dir={isRTL ? 'rtl' : 'ltr'}>
            {t('parentalControls.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Protection Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                {t('parentalControls.enableProtection')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('parentalControls.protectionDescription')}
              </p>
            </div>
            <Switch
              checked={settings.isPinProtectionEnabled}
              onCheckedChange={handleToggleProtection}
            />
          </div>

          {/* PIN Management Buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleChangePin}
              className="w-full justify-start"
            >
              <Lock className="mr-2 h-4 w-4" />
              {hasParentalPin() 
                ? t('parentalControls.changePin')
                : t('parentalControls.setupPin')
              }
            </Button>

            {hasParentalPin() && (
              <Button
                variant="outline"
                onClick={handleRemovePin}
                className="w-full justify-start text-destructive border-destructive/20 hover:bg-destructive/5"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('parentalControls.removePin')}
              </Button>
            )}
          </div>

          {/* Status Information */}
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2 text-sm">
              {settings.isPinProtectionEnabled ? (
                <>
                  <Lock className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">
                    {t('parentalControls.protectionEnabled')}
                  </span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {t('parentalControls.protectionDisabled')}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ParentalPinDialog
        open={showPinDialog}
        onValidated={handlePinValidated}
        onCancel={handlePinDialogCancel}
      />
    </>
  );
};