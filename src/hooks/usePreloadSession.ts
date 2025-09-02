import { useState, useEffect, useCallback } from 'react';
import { documentStore } from '@/utils/documentStore';

interface PreloadSession {
  sessionId: string;
  completedLevels: Set<string>;
  lastActivity: number;
}

/**
 * Hook to manage preload sessions and prevent duplicate downloads
 */
export const usePreloadSession = () => {
  const [session, setSession] = useState<PreloadSession | null>(null);

  useEffect(() => {
    // Initialize or restore session
    const initSession = async () => {
      try {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const currentTime = Date.now();
        
        // Check if there's a recent session (within last hour)
        const existingSessionData = await documentStore.getMetadata('currentPreloadSession');
        
        if (existingSessionData && 
            currentTime - existingSessionData.lastActivity < 60 * 60 * 1000) { // 1 hour
          // Restore existing session
          const completedLevels = new Set<string>(existingSessionData.completedLevels || []);
          setSession({
            sessionId: existingSessionData.sessionId,
            completedLevels,
            lastActivity: currentTime
          });
          console.log('Restored preload session:', existingSessionData.sessionId, 'with', completedLevels.size, 'completed levels');
        } else {
          // Create new session
          const newSession = {
            sessionId,
            completedLevels: new Set<string>(),
            lastActivity: currentTime
          };
          setSession(newSession);
          console.log('Created new preload session:', sessionId);
        }
      } catch (error) {
        console.error('Failed to initialize preload session:', error);
        // Fallback to new session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSession({
          sessionId,
          completedLevels: new Set(),
          lastActivity: Date.now()
        });
      }
    };

    initSession();
  }, []);

  const markLevelCompleted = useCallback(async (folderId: string) => {
    if (!session) return;

    const updatedSession = {
      ...session,
      completedLevels: new Set([...session.completedLevels, folderId]),
      lastActivity: Date.now()
    };

    setSession(updatedSession);

    // Persist to storage
    try {
      await documentStore.saveMetadata('currentPreloadSession', {
        sessionId: updatedSession.sessionId,
        completedLevels: Array.from(updatedSession.completedLevels),
        lastActivity: updatedSession.lastActivity
      });
      console.log('Marked level as completed in session:', folderId);
    } catch (error) {
      console.error('Failed to persist session data:', error);
    }
  }, [session]);

  const isLevelCompleted = useCallback((folderId: string): boolean => {
    return session?.completedLevels.has(folderId) || false;
  }, [session]);

  const clearSession = useCallback(async () => {
    if (!session) return;

    try {
      await documentStore.removeMetadata('currentPreloadSession');
      setSession({
        ...session,
        completedLevels: new Set(),
        lastActivity: Date.now()
      });
      console.log('Cleared preload session');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }, [session]);

  return {
    sessionId: session?.sessionId || null,
    isLevelCompleted,
    markLevelCompleted,
    clearSession,
    completedCount: session?.completedLevels.size || 0,
    isSessionReady: session !== null
  };
};