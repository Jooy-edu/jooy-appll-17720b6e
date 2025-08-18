import { useQuery } from '@tanstack/react-query';

export const useDocumentPages = (documentId?: string) => {
  return useQuery({
    queryKey: ['document-pages', documentId],
    queryFn: async () => {
      if (!documentId) throw new Error('Document ID is required');
      
      // Try to fetch worksheet data to get page count
      try {
        const response = await fetch(`/data/${documentId}.json`);
        if (response.ok) {
          const data = await response.json();
          if (data.mode === 'auto' && data.data) {
            return { maxPages: data.data.length };
          }
          if (data.regions) {
            const maxPage = Math.max(...data.regions.map((r: any) => r.page || r.pageNumber || 1));
            return { maxPages: maxPage };
          }
        }
      } catch (error) {
        console.log('Could not fetch local worksheet data:', error);
      }
      
      // Default fallback
      return { maxPages: 10 };
    },
    enabled: !!documentId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};