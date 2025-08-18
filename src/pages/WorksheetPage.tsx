import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import WorksheetViewer from "@/components/WorksheetViewer";
import AutoModeContentDisplay from "@/components/AutoModeContentDisplay";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData, GuidanceItem, AutoModePageData } from "@/types/worksheet";

interface StoredRegionData {
  currentStepIndex: number;
}

interface StoredGuidanceData {
  currentStepIndex: number;
}

interface SessionPageData {
  lastActiveRegionId: string | null;
  lastActiveGuidanceIndex: number | null;
  regions: Record<string, StoredRegionData>;
  guidance: Record<number, StoredGuidanceData>;
}

const WorksheetPage: React.FC = () => {
  const { t } = useTranslation();
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveRegion, setCurrentActiveRegion] = useState<RegionData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentActiveGuidance, setCurrentActiveGuidance] = useState<GuidanceItem | null>(null);
  const [currentGuidanceStepIndex, setCurrentGuidanceStepIndex] = useState<number>(0);
  const [allRegionsState, setAllRegionsState] = useState<Record<string, StoredRegionData>>({});
  const [allGuidanceState, setAllGuidanceState] = useState<Record<number, StoredGuidanceData>>({});
  const [initialActiveRegion, setInitialActiveRegion] = useState<RegionData | null>(null);
  const [initialCurrentStepIndex, setInitialCurrentStepIndex] = useState<number>(0);
  const [initialActiveGuidance, setInitialActiveGuidance] = useState<GuidanceItem | null>(null);
  const [initialGuidanceStepIndex, setInitialGuidanceStepIndex] = useState<number>(0);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveRegion?: RegionData; 
    initialCurrentStepIndex?: number; 
    initialActiveGuidance?: GuidanceItem;
    initialGuidanceStepIndex?: number;
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
  // Enable zooming for worksheet page
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      // Store original viewport content
      const originalContent = viewportMeta.content;
      
      // Enable zooming for worksheet page
      viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
      
      // Cleanup function to restore original viewport when component unmounts
      return () => {
        if (viewportMeta) {
          viewportMeta.content = originalContent;
        }
      };
    }
  }, []);
  
  // Control zooming based on text mode state
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      if (isTextModeActive) {
        // Disable zooming and reset zoom when entering text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0";
        console.log('Zoom disabled and reset due to text mode activation');
      } else {
        // Re-enable zooming when exiting text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
        console.log('Zoom re-enabled due to text mode deactivation');
      }
    }
  }, [isTextModeActive]);
  
  // Load session state when worksheet or page changes
  useEffect(() => {
    if (!id || !n) return;
    
    const sessionKey = `worksheet_page_state_${id}_${n}`;
    console.log('🔍 [DEBUG] Loading session state with key:', sessionKey);
    
    try {
      const storedState = sessionStorage.getItem(sessionKey);
      console.log('🔍 [DEBUG] Raw stored state from sessionStorage:', storedState);
      
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SessionPageData;
        console.log('🔍 [DEBUG] Parsed session state:', parsedState);
        
        // Set all regions state
        setAllRegionsState(parsedState.regions || {});
        console.log('🔍 [DEBUG] Set allRegionsState to:', parsedState.regions || {});
        
        // Set all guidance state
        setAllGuidanceState(parsedState.guidance || {});
        
        // If we have location state (from AI chat), prioritize that
        if (locationState?.initialActiveRegion) {
          console.log('🔍 [DEBUG] Using location state - initialActiveRegion:', locationState.initialActiveRegion);
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (parsedState.lastActiveRegionId && worksheetData?.meta?.regions) {
          // Find the last active region from the stored data
          const lastActiveRegion = worksheetData.meta.regions.find(
            region => region.id === parsedState.lastActiveRegionId
          );
          if (lastActiveRegion) {
            const regionState = parsedState.regions[parsedState.lastActiveRegionId];
            console.log('🔍 [DEBUG] Found last active region:', lastActiveRegion.id, 'with state:', regionState);
            setInitialActiveRegion(lastActiveRegion);
            setInitialCurrentStepIndex(regionState?.currentStepIndex || 0);
          }
        } else if (locationState?.initialActiveGuidance) {
          console.log('🔍 [DEBUG] Using location state - initialActiveGuidance:', locationState.initialActiveGuidance);
          setInitialActiveGuidance(locationState.initialActiveGuidance);
          setInitialGuidanceStepIndex(locationState.initialGuidanceStepIndex || 0);
        } else if (parsedState.lastActiveGuidanceIndex !== null && worksheetData?.meta?.mode === 'auto' && 'data' in worksheetData.meta) {
          // Find the last active guidance from the stored data (only for auto mode)
          const pageIndex = parseInt(n, 10);
          const pageData = worksheetData.meta.data.find(page => page.page_number === pageIndex);
          if (pageData && pageData.guidance[parsedState.lastActiveGuidanceIndex]) {
            const lastActiveGuidance = pageData.guidance[parsedState.lastActiveGuidanceIndex];
            const guidanceState = parsedState.guidance[parsedState.lastActiveGuidanceIndex];
            console.log('🔍 [DEBUG] Found last active guidance:', parsedState.lastActiveGuidanceIndex, 'with state:', guidanceState);
            setInitialActiveGuidance(lastActiveGuidance);
            setInitialGuidanceStepIndex(guidanceState?.currentStepIndex || 0);
          }
        }
      } else {
        console.log('🔍 [DEBUG] No session state found for key:', sessionKey);
        setAllRegionsState({});
        setAllGuidanceState({});
        
        // Use location state if available
        if (locationState?.initialActiveRegion) {
          console.log('🔍 [DEBUG] Using location state (no session) - initialActiveRegion:', locationState.initialActiveRegion);
          setInitialActiveRegion(locationState.initialActiveRegion);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (locationState?.initialActiveGuidance) {
          console.log('🔍 [DEBUG] Using location state (no session) - initialActiveGuidance:', locationState.initialActiveGuidance);
          setInitialActiveGuidance(locationState.initialActiveGuidance);
          setInitialGuidanceStepIndex(locationState.initialGuidanceStepIndex || 0);
        }
      }
    } catch (error) {
      console.warn('🔍 [DEBUG] Failed to load session state:', error);
      setAllRegionsState({});
      setAllGuidanceState({});
      
      // Use location state if available
      if (locationState?.initialActiveRegion) {
        console.log('🔍 [DEBUG] Using location state (error fallback) - initialActiveRegion:', locationState.initialActiveRegion);
        setInitialActiveRegion(locationState.initialActiveRegion);
        setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
      } else if (locationState?.initialActiveGuidance) {
        console.log('🔍 [DEBUG] Using location state (error fallback) - initialActiveGuidance:', locationState.initialActiveGuidance);
        setInitialActiveGuidance(locationState.initialActiveGuidance);
        setInitialGuidanceStepIndex(locationState.initialGuidanceStepIndex || 0);
      }
    }
  }, [id, n, locationState, worksheetData]);
  
  const goBack = () => {
    navigate("/");
  };

  // Memoize the handleRegionStateChange function to prevent unnecessary re-renders
  const handleRegionStateChange = useCallback((region: RegionData | null, stepIndex: number) => {
    console.log('🔍 [DEBUG] handleRegionStateChange called with region:', region?.id, 'stepIndex:', stepIndex);
    
    // Only update state if there's an actual change
    setCurrentActiveRegion(prevRegion => {
      const regionChanged = prevRegion?.id !== region?.id;
      if (regionChanged) {
        console.log('🔍 [DEBUG] Region changed from', prevRegion?.id, 'to', region?.id);
      }
      return regionChanged ? region : prevRegion;
    });
    
    setCurrentStepIndex(prevStepIndex => {
      const stepChanged = prevStepIndex !== stepIndex;
      if (stepChanged) {
        console.log('🔍 [DEBUG] Step index changed from', prevStepIndex, 'to', stepIndex);
      }
      return stepChanged ? stepIndex : prevStepIndex;
    });
    
    // Update all regions state and save to session storage
    if (id && n) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      console.log('🔍 [DEBUG] Using session key for save:', sessionKey);
      
      // Use functional update to ensure we have the latest state
      setAllRegionsState(currentAllRegionsState => {
        console.log('🔍 [DEBUG] Current allRegionsState before update:', currentAllRegionsState);
        
        if (region) {
          // Update the state for this specific region
          const updatedAllRegionsState = {
            ...currentAllRegionsState,
            [region.id]: {
              currentStepIndex: stepIndex
            }
          };
          console.log('🔍 [DEBUG] Updated region state for:', region.id, 'with stepIndex:', stepIndex);
          
          const stateToSave: SessionPageData = {
            lastActiveRegionId: region.id,
            lastActiveGuidanceIndex: null,
            regions: updatedAllRegionsState,
            guidance: allGuidanceState
          };
          
          console.log('🔍 [DEBUG] About to save state to sessionStorage:', stateToSave);
          
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
            console.log('🔍 [DEBUG] Successfully saved state to sessionStorage with key:', sessionKey);
            
            // Verify the save by immediately reading it back
            const verifyState = sessionStorage.getItem(sessionKey);
            console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to save page state to session:', error);
          }
          
          return updatedAllRegionsState;
        } else {
          // When no active region, check if we need to update sessionStorage
          try {
            const currentStoredState = sessionStorage.getItem(sessionKey);
            let currentSessionData: SessionPageData | null = null;
            
            if (currentStoredState) {
              currentSessionData = JSON.parse(currentStoredState);
            }
            
            // Only update sessionStorage if lastActiveRegionId is not already null
            if (currentSessionData?.lastActiveRegionId !== null) {
              const stateToSave: SessionPageData = {
                lastActiveRegionId: null,
                lastActiveGuidanceIndex: null,
                regions: currentAllRegionsState,
                guidance: allGuidanceState
              };
              
              console.log('🔍 [DEBUG] About to save state (no active region) to sessionStorage:', stateToSave);
              
              sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
              console.log('🔍 [DEBUG] Successfully updated last active region in session with key:', sessionKey);
              
              // Verify the save by immediately reading it back
              const verifyState = sessionStorage.getItem(sessionKey);
              console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
            } else {
              console.log('🔍 [DEBUG] No sessionStorage update needed - lastActiveRegionId already null');
            }
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to update session state:', error);
          }
          console.log('🔍 [DEBUG] Returning unchanged allRegionsState:', currentAllRegionsState);
          // Return the same object reference to prevent unnecessary re-renders
          return currentAllRegionsState;
        }
      });
    }
  }, [id, n, allGuidanceState]); // Include allGuidanceState in dependencies

  // Handle guidance state changes for Auto Mode
  const handleGuidanceStateChange = useCallback((guidance: GuidanceItem | null, stepIndex: number) => {
    console.log('🔍 [DEBUG] handleGuidanceStateChange called with guidance:', guidance?.title, 'stepIndex:', stepIndex);
    
    setCurrentActiveGuidance(prevGuidance => {
      const guidanceChanged = prevGuidance?.title !== guidance?.title;
      if (guidanceChanged) {
        console.log('🔍 [DEBUG] Guidance changed from', prevGuidance?.title, 'to', guidance?.title);
      }
      return guidanceChanged ? guidance : prevGuidance;
    });
    
    setCurrentGuidanceStepIndex(prevStepIndex => {
      const stepChanged = prevStepIndex !== stepIndex;
      if (stepChanged) {
        console.log('🔍 [DEBUG] Guidance step index changed from', prevStepIndex, 'to', stepIndex);
      }
      return stepChanged ? stepIndex : prevStepIndex;
    });
    
    // Update guidance state and save to session storage
    if (id && n && worksheetData?.meta?.mode === 'auto' && 'data' in worksheetData.meta) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      const pageIndex = parseInt(n, 10);
      const pageData = worksheetData.meta.data.find(page => page.page_number === pageIndex);
      
      if (pageData && guidance) {
        const guidanceIndex = pageData.guidance.findIndex(g => g.title === guidance.title);
        
        if (guidanceIndex !== -1) {
          setAllGuidanceState(currentAllGuidanceState => {
            const updatedAllGuidanceState = {
              ...currentAllGuidanceState,
              [guidanceIndex]: {
                currentStepIndex: stepIndex
              }
            };
            
            const stateToSave: SessionPageData = {
              lastActiveRegionId: null,
              lastActiveGuidanceIndex: guidanceIndex,
              regions: allRegionsState,
              guidance: updatedAllGuidanceState
            };
            
            try {
              sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
              console.log('🔍 [DEBUG] Successfully saved guidance state to sessionStorage');
            } catch (error) {
              console.warn('🔍 [DEBUG] Failed to save guidance state to session:', error);
            }
            
            return updatedAllGuidanceState;
          });
        }
      } else if (!guidance) {
        // Clear active guidance
        try {
          const currentStoredState = sessionStorage.getItem(sessionKey);
          let currentSessionData: SessionPageData | null = null;
          
          if (currentStoredState) {
            currentSessionData = JSON.parse(currentStoredState);
          }
          
          if (currentSessionData?.lastActiveGuidanceIndex !== null) {
            const stateToSave: SessionPageData = {
              lastActiveRegionId: null,
              lastActiveGuidanceIndex: null,
              regions: allRegionsState,
              guidance: allGuidanceState
            };
            
            sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
            console.log('🔍 [DEBUG] Successfully cleared active guidance in session');
          }
        } catch (error) {
          console.warn('🔍 [DEBUG] Failed to update guidance session state:', error);
        }
      }
    }
  }, [id, n, worksheetData, allRegionsState, allGuidanceState]);
  
  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('aiChat.missingInfo')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  const pageIndex = parseInt(n, 10);
  
  if (isNaN(pageIndex)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.invalidPage')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <p className="text-lg">{t('worksheet.loading')}</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error || !worksheetData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {error?.message || t('worksheet.notFound')}
          </h1>
          <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white">
            {t('worksheet.returnToScanner')}
          </Button>
        </div>
      </div>
    );
  }

  // Get the current page data for Auto Mode
  const getCurrentPageData = (): AutoModePageData | null => {
    if (worksheetData?.meta?.mode === 'auto' && 'data' in worksheetData.meta) {
      return worksheetData.meta.data.find(page => page.page_number === pageIndex) || null;
    }
    return null;
  };

  const currentPageData = getCurrentPageData();
  
  // Get page description for AI context (only for auto mode)
  const pageDescriptionForAI = worksheetData?.meta?.mode === 'auto' && currentPageData 
    ? currentPageData.page_description 
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {worksheetData.meta.mode === 'auto' && currentPageData ? (
        <AutoModeContentDisplay
          worksheetId={id}
          pageNumber={pageIndex}
          autoModePageData={currentPageData}
          pdfUrl={worksheetData.pdfUrl}
          onTextModeChange={setIsTextModeActive}
          onGuidanceStateChange={handleGuidanceStateChange}
          initialActiveGuidance={initialActiveGuidance}
          initialGuidanceStepIndex={initialGuidanceStepIndex}
          allGuidanceState={allGuidanceState}
        />
      ) : (
        <WorksheetViewer 
          worksheetId={id} 
          pageIndex={pageIndex} 
          worksheetMeta={worksheetData.meta as any}
          pdfUrl={worksheetData.pdfUrl}
          onTextModeChange={setIsTextModeActive}
          initialActiveRegion={initialActiveRegion}
          initialCurrentStepIndex={initialCurrentStepIndex}
          onRegionStateChange={handleRegionStateChange}
          allRegionsState={allRegionsState}
        />
      )}
      <AIChatButton 
        worksheetId={id} 
        pageNumber={pageIndex} 
        isTextModeActive={isTextModeActive}
        activeRegion={worksheetData.meta.mode === 'auto' ? null : currentActiveRegion}
        currentStepIndex={worksheetData.meta.mode === 'auto' ? currentGuidanceStepIndex : currentStepIndex}
        pdfUrl={worksheetData.pdfUrl}
        worksheetMeta={worksheetData.meta}
        pageDescriptionForAI={pageDescriptionForAI}
        activeGuidance={worksheetData.meta.mode === 'auto' ? currentActiveGuidance : null}
      />
    </div>
  );
};

export default WorksheetPage;