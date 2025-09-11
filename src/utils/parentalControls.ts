export interface ParentalControlsSettings {
  hasPin: boolean;
  pinHash?: string;
  isPinProtectionEnabled: boolean;
  skipPinProtection: boolean;
  firstTimeSetupCompleted: boolean;
}

const PARENTAL_CONTROLS_KEY = 'parental_controls';
const SESSION_VALIDATED_KEY = 'parental_pin_validated';

// Simple hash function for PIN storage (not cryptographically secure, but sufficient for this use case)
const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

export const getParentalControlsSettings = (): ParentalControlsSettings => {
  try {
    const stored = localStorage.getItem(PARENTAL_CONTROLS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading parental controls settings:', error);
  }
  
  return {
    hasPin: false,
    isPinProtectionEnabled: false,
    skipPinProtection: false,
    firstTimeSetupCompleted: false,
  };
};

const saveParentalControlsSettings = (settings: ParentalControlsSettings): void => {
  try {
    localStorage.setItem(PARENTAL_CONTROLS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving parental controls settings:', error);
  }
};

export const setParentalPin = (pin: string): boolean => {
  try {
    if (!pin || pin.length < 4) {
      return false;
    }
    
    const settings = getParentalControlsSettings();
    settings.hasPin = true;
    settings.pinHash = hashPin(pin);
    settings.isPinProtectionEnabled = true;
    settings.firstTimeSetupCompleted = true;
    
    saveParentalControlsSettings(settings);
    return true;
  } catch (error) {
    console.error('Error setting parental PIN:', error);
    return false;
  }
};

export const validateParentalPin = (pin: string): boolean => {
  try {
    const settings = getParentalControlsSettings();
    if (!settings.hasPin || !settings.pinHash) {
      return false;
    }
    
    return hashPin(pin) === settings.pinHash;
  } catch (error) {
    console.error('Error validating parental PIN:', error);
    return false;
  }
};

export const hasParentalPin = (): boolean => {
  const settings = getParentalControlsSettings();
  return settings.hasPin && !!settings.pinHash;
};

export const isPinProtectionEnabled = (): boolean => {
  const settings = getParentalControlsSettings();
  return settings.isPinProtectionEnabled && !settings.skipPinProtection;
};

export const removeParentalPin = (): void => {
  try {
    const settings = getParentalControlsSettings();
    settings.hasPin = false;
    settings.pinHash = undefined;
    settings.isPinProtectionEnabled = false;
    
    saveParentalControlsSettings(settings);
    clearSessionValidation();
  } catch (error) {
    console.error('Error removing parental PIN:', error);
  }
};

export const togglePinProtection = (enabled: boolean): void => {
  try {
    const settings = getParentalControlsSettings();
    settings.isPinProtectionEnabled = enabled;
    
    saveParentalControlsSettings(settings);
    
    if (!enabled) {
      clearSessionValidation();
    }
  } catch (error) {
    console.error('Error toggling PIN protection:', error);
  }
};

export const skipPinProtection = (): void => {
  try {
    const settings = getParentalControlsSettings();
    settings.skipPinProtection = true;
    settings.firstTimeSetupCompleted = true;
    
    saveParentalControlsSettings(settings);
  } catch (error) {
    console.error('Error skipping PIN protection:', error);
  }
};

export const isFirstTimeSetup = (): boolean => {
  const settings = getParentalControlsSettings();
  return !settings.firstTimeSetupCompleted && !settings.skipPinProtection;
};

export const setSessionValidated = (): void => {
  try {
    sessionStorage.setItem(SESSION_VALIDATED_KEY, 'true');
  } catch (error) {
    console.error('Error setting session validation:', error);
  }
};

export const isSessionValidated = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_VALIDATED_KEY) === 'true';
  } catch (error) {
    console.error('Error checking session validation:', error);
    return false;
  }
};

export const clearSessionValidation = (): void => {
  try {
    sessionStorage.removeItem(SESSION_VALIDATED_KEY);
  } catch (error) {
    console.error('Error clearing session validation:', error);
  }
};

export const shouldShowPinPrompt = (): boolean => {
  return isPinProtectionEnabled() && hasParentalPin() && !isSessionValidated();
};