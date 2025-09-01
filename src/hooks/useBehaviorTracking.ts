import { useCallback, useEffect } from 'react';
import { enhancedCache } from '@/utils/enhancedCacheManager';
import { useAuth } from '@/contexts/AuthContext';

interface UserBehaviorData {
  levelAccess: Record<string, {
    levelId: string;
    levelName: string;
    accessCount: number;
    lastAccessed: number;
    totalTimeSpent: number;
    documentsViewed: string[];
    preferredDocuments: string[];
  }>;
  documentAccess: Record<string, {
    documentId: string;
    documentName: string;
    accessCount: number;
    lastAccessed: number;
    averageViewTime: number;
    pagesViewed: number[];
    levelId?: string;
  }>;
  preloadingPreferences: {
    enableAutoPreload: boolean;
    maxStorageUsage: number; // MB
    networkAwarePreloading: boolean;
  };
}

const DEFAULT_BEHAVIOR_DATA: UserBehaviorData = {
  levelAccess: {},
  documentAccess: {},
  preloadingPreferences: {
    enableAutoPreload: true,
    maxStorageUsage: 100, // 100MB default
    networkAwarePreloading: true,
  }
};

export const useBehaviorTracking = () => {
  const { user } = useAuth();

  // Get user behavior data
  const getBehaviorData = useCallback(async (): Promise<UserBehaviorData> => {
    if (!user?.id) return DEFAULT_BEHAVIOR_DATA;

    try {
      const cached = await enhancedCache.getEnhanced<UserBehaviorData>('user_behavior', user.id);
      return cached || DEFAULT_BEHAVIOR_DATA;
    } catch (error) {
      console.error('Failed to get behavior data:', error);
      return DEFAULT_BEHAVIOR_DATA;
    }
  }, [user?.id]);

  // Track level access
  const trackLevelAccess = useCallback(async (
    levelId: string, 
    levelName: string, 
    sessionStartTime: number = Date.now()
  ) => {
    if (!user?.id) return;

    try {
      const behaviorData = await getBehaviorData();
      const existing = behaviorData.levelAccess[levelId] || {
        levelId,
        levelName,
        accessCount: 0,
        lastAccessed: 0,
        totalTimeSpent: 0,
        documentsViewed: [],
        preferredDocuments: []
      };

      const updatedLevelData = {
        ...existing,
        accessCount: existing.accessCount + 1,
        lastAccessed: Date.now(),
        totalTimeSpent: existing.totalTimeSpent + (Date.now() - sessionStartTime),
      };

      const updatedBehaviorData = {
        ...behaviorData,
        levelAccess: {
          ...behaviorData.levelAccess,
          [levelId]: updatedLevelData
        }
      };

      await enhancedCache.setEnhanced('user_behavior', user.id, updatedBehaviorData, {
        priority: 'high',
        version: '1.0'
      });
    } catch (error) {
      console.error('Failed to track level access:', error);
    }
  }, [user?.id, getBehaviorData]);

  // Track document access
  const trackDocumentAccess = useCallback(async (
    documentId: string,
    documentName: string,
    levelId?: string,
    viewStartTime: number = Date.now()
  ) => {
    if (!user?.id) return;

    try {
      const behaviorData = await getBehaviorData();
      const existing = behaviorData.documentAccess[documentId] || {
        documentId,
        documentName,
        accessCount: 0,
        lastAccessed: 0,
        averageViewTime: 0,
        pagesViewed: [],
        levelId
      };

      const viewTime = Date.now() - viewStartTime;
      const newAverageViewTime = existing.accessCount > 0 
        ? (existing.averageViewTime * existing.accessCount + viewTime) / (existing.accessCount + 1)
        : viewTime;

      const updatedDocumentData = {
        ...existing,
        accessCount: existing.accessCount + 1,
        lastAccessed: Date.now(),
        averageViewTime: newAverageViewTime,
        levelId: levelId || existing.levelId
      };

      const updatedBehaviorData = {
        ...behaviorData,
        documentAccess: {
          ...behaviorData.documentAccess,
          [documentId]: updatedDocumentData
        }
      };

      // Update level's preferred documents if applicable
      if (levelId && behaviorData.levelAccess[levelId]) {
        const levelData = behaviorData.levelAccess[levelId];
        const documentsViewed = [...new Set([...levelData.documentsViewed, documentId])];
        
        // Calculate preferred documents based on access frequency
        const preferredDocuments = Object.values(updatedBehaviorData.documentAccess)
          .filter(doc => doc.levelId === levelId)
          .sort((a, b) => b.accessCount - a.accessCount)
          .slice(0, 5) // Top 5 most accessed documents
          .map(doc => doc.documentId);

        updatedBehaviorData.levelAccess[levelId] = {
          ...levelData,
          documentsViewed,
          preferredDocuments
        };
      }

      await enhancedCache.setEnhanced('user_behavior', user.id, updatedBehaviorData, {
        priority: 'high',
        version: '1.0'
      });
    } catch (error) {
      console.error('Failed to track document access:', error);
    }
  }, [user?.id, getBehaviorData]);

  // Track page viewing within documents
  const trackPageView = useCallback(async (documentId: string, pageNumber: number) => {
    if (!user?.id) return;

    try {
      const behaviorData = await getBehaviorData();
      const documentData = behaviorData.documentAccess[documentId];
      
      if (documentData) {
        const pagesViewed = [...new Set([...documentData.pagesViewed, pageNumber])];
        
        const updatedBehaviorData = {
          ...behaviorData,
          documentAccess: {
            ...behaviorData.documentAccess,
            [documentId]: {
              ...documentData,
              pagesViewed
            }
          }
        };

        await enhancedCache.setEnhanced('user_behavior', user.id, updatedBehaviorData, {
          priority: 'medium',
          version: '1.0'
        });
      }
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }, [user?.id, getBehaviorData]);

  // Get predictive preloading recommendations
  const getPredictiveRecommendations = useCallback(async () => {
    if (!user?.id) return { levels: [], documents: [] };

    try {
      const behaviorData = await getBehaviorData();
      
      // Recommend levels based on recent access and frequency
      const levelRecommendations = Object.values(behaviorData.levelAccess)
        .sort((a, b) => {
          const aScore = a.accessCount * 0.7 + (Date.now() - a.lastAccessed > 24 * 60 * 60 * 1000 ? 0 : 0.3);
          const bScore = b.accessCount * 0.7 + (Date.now() - b.lastAccessed > 24 * 60 * 60 * 1000 ? 0 : 0.3);
          return bScore - aScore;
        })
        .slice(0, 3) // Top 3 levels
        .map(level => level.levelId);

      // Recommend documents based on frequency and recency
      const documentRecommendations = Object.values(behaviorData.documentAccess)
        .sort((a, b) => {
          const aScore = a.accessCount * 0.8 + (Date.now() - a.lastAccessed > 7 * 24 * 60 * 60 * 1000 ? 0 : 0.2);
          const bScore = b.accessCount * 0.8 + (Date.now() - b.lastAccessed > 7 * 24 * 60 * 60 * 1000 ? 0 : 0.2);
          return bScore - aScore;
        })
        .slice(0, 10) // Top 10 documents
        .map(doc => doc.documentId);

      return {
        levels: levelRecommendations,
        documents: documentRecommendations
      };
    } catch (error) {
      console.error('Failed to get predictive recommendations:', error);
      return { levels: [], documents: [] };
    }
  }, [user?.id, getBehaviorData]);

  // Update preloading preferences
  const updatePreloadingPreferences = useCallback(async (preferences: Partial<UserBehaviorData['preloadingPreferences']>) => {
    if (!user?.id) return;

    try {
      const behaviorData = await getBehaviorData();
      const updatedBehaviorData = {
        ...behaviorData,
        preloadingPreferences: {
          ...behaviorData.preloadingPreferences,
          ...preferences
        }
      };

      await enhancedCache.setEnhanced('user_behavior', user.id, updatedBehaviorData, {
        priority: 'high',
        version: '1.0'
      });
    } catch (error) {
      console.error('Failed to update preloading preferences:', error);
    }
  }, [user?.id, getBehaviorData]);

  return {
    getBehaviorData,
    trackLevelAccess,
    trackDocumentAccess,
    trackPageView,
    getPredictiveRecommendations,
    updatePreloadingPreferences
  };
};