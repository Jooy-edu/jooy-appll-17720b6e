import React from 'react';
import { LibraryPage } from './LibraryPage';
import { CacheStatusIndicator } from '@/components/CacheStatusIndicator';

export const LibraryPageWithCacheStatus: React.FC = () => {
  return (
    <div className="relative">
      <LibraryPage />
      
      {/* Cache Status Indicator - Fixed position in top right */}
      <div className="fixed top-4 right-4 z-50">
        <CacheStatusIndicator showDetails className="shadow-lg" />
      </div>
    </div>
  );
};