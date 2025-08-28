import { supabase } from '@/integrations/supabase/client';

export interface CoverImageResult {
  url: string | null;
  error?: string;
}

/**
 * Extract cover image path from document metadata
 */
export const extractCoverPath = (metadata: any): string | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  return metadata.cover_image_path || null;
};

/**
 * Get signed URL for cover image from covers bucket
 */
export const getCoverImageUrl = async (documentId: string, extension: string = 'jpg'): Promise<CoverImageResult> => {
  try {
    const filePath = `${documentId}.${extension}`;
    
    const { data, error } = await supabase.storage
      .from('covers')
      .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

    if (error) {
      console.error('Error getting cover image URL:', error);
      return { url: null, error: error.message };
    }

    return { url: data?.signedUrl || null };
  } catch (error) {
    console.error('Error in getCoverImageUrl:', error);
    return { url: null, error: 'Failed to get cover image' };
  }
};

/**
 * Try multiple extensions to find a cover image
 */
export const findCoverImage = async (documentId: string): Promise<CoverImageResult> => {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  
  for (const ext of extensions) {
    const result = await getCoverImageUrl(documentId, ext);
    if (result.url) {
      return result;
    }
  }
  
  return { url: null, error: 'No cover image found' };
};

/**
 * Check if cover image exists in storage
 */
export const coverImageExists = async (documentId: string, extension: string = 'jpg'): Promise<boolean> => {
  try {
    const filePath = `${documentId}.${extension}`;
    
    const { data, error } = await supabase.storage
      .from('covers')
      .list('', {
        search: filePath,
        limit: 1
      });

    if (error) return false;
    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking cover existence:', error);
    return false;
  }
};