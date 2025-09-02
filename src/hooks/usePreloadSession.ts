import { useState, useEffect } from 'react';

interface PreloadSessionData {
  completedLevels: string[];
  sessionId: string;
  timestamp: number;
}

const SESSION_STORAGE_KEY = 'preload-session-data';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const usePreloadSession = () => {
  const [sessionData, setSessionData] = useState<PreloadSessionData>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if session is still valid (within 24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < SESSION_DURATION) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to parse preload session data:', error);
    }
    
    // Create new session
    return {
      completedLevels: [],
      sessionId: `session-${Date.now()}`,
      timestamp: Date.now()
    };
  });

  // Save to sessionStorage whenever data changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save preload session data:', error);
    }
  }, [sessionData]);

  const isLevelCompleted = (levelId: string) => {
    return sessionData.completedLevels.includes(levelId);
  };

  const markLevelCompleted = (levelId: string) => {
    if (!isLevelCompleted(levelId)) {
      setSessionData(prev => ({
        ...prev,
        completedLevels: [...prev.completedLevels, levelId],
        timestamp: Date.now()
      }));
    }
  };

  const resetSession = () => {
    setSessionData({
      completedLevels: [],
      sessionId: `session-${Date.now()}`,
      timestamp: Date.now()
    });
  };

  return {
    isLevelCompleted,
    markLevelCompleted,
    resetSession,
    sessionId: sessionData.sessionId,
    completedCount: sessionData.completedLevels.length
  };
};