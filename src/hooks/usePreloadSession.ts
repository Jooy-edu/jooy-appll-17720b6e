import { useState, useEffect, useCallback } from 'react';

interface SessionPreloadState {
  completedLevels: Set<string>;
  sessionId: string;
  lastPreloadTime: number;
}

const SESSION_STORAGE_KEY = 'preload_session_state';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

export const usePreloadSession = () => {
  const [sessionState, setSessionState] = useState<SessionPreloadState>(() => {
    // Initialize from sessionStorage or create new session
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if session is still valid (not expired)
        if (Date.now() - parsed.lastPreloadTime < SESSION_DURATION) {
          return {
            ...parsed,
            completedLevels: new Set(parsed.completedLevels || [])
          };
        }
      } catch (error) {
        console.warn('Failed to parse session preload state:', error);
      }
    }
    
    // Create new session
    return {
      completedLevels: new Set<string>(),
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastPreloadTime: Date.now()
    };
  });

  // Persist session state to sessionStorage
  useEffect(() => {
    const stateToStore = {
      ...sessionState,
      completedLevels: Array.from(sessionState.completedLevels)
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateToStore));
  }, [sessionState]);

  const markLevelCompleted = useCallback((folderId: string) => {
    setSessionState(prev => ({
      ...prev,
      completedLevels: new Set([...prev.completedLevels, folderId]),
      lastPreloadTime: Date.now()
    }));
  }, []);

  const isLevelCompleted = useCallback((folderId: string) => {
    return sessionState.completedLevels.has(folderId);
  }, [sessionState.completedLevels]);

  const clearSession = useCallback(() => {
    setSessionState({
      completedLevels: new Set<string>(),
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastPreloadTime: Date.now()
    });
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const hasRecentPreloadActivity = useCallback(() => {
    const timeSinceLastPreload = Date.now() - sessionState.lastPreloadTime;
    return timeSinceLastPreload < SESSION_DURATION;
  }, [sessionState.lastPreloadTime]);

  return {
    markLevelCompleted,
    isLevelCompleted,
    clearSession,
    hasRecentPreloadActivity,
    completedLevelsCount: sessionState.completedLevels.size,
    sessionId: sessionState.sessionId
  };
};