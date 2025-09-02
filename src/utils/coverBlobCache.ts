import { supabase } from '@/integrations/supabase/client';
import { documentStore } from './documentStore';

export interface CoverBlobResult {
  success: boolean;
  blobUrl?: string;
  error?: string;
}

/**
 * Download and cache cover image as blob
 */
export const downloadAndCacheCover = async (
  documentId: string, 
  extension: string = 'jpg'
): Promise<CoverBlobResult> => {
  try {
    const filePath = `${documentId}.${extension}`;
    
    // Get signed URL first
    const { data: urlData, error: urlError } = await supabase.storage
      .from('covers')
      .createSignedUrl(filePath, 60); // Short expiry, we just need to download

    if (urlError || !urlData?.signedUrl) {
      return { success: false, error: `Cover not found: ${urlError?.message}` };
    }

    // Download the actual file
    const response = await fetch(urlData.signedUrl);
    if (!response.ok) {
      return { success: false, error: `Failed to download cover: ${response.statusText}` };
    }

    const blob = await response.blob();
    const lastModified = response.headers.get('last-modified') 
      ? new Date(response.headers.get('last-modified')!).getTime() 
      : Date.now();

    // Cache the blob
    await documentStore.saveCover(documentId, blob, { 
      extension,
      lastModified,
      size: blob.size,
      contentType: blob.type,
      etag: response.headers.get('etag') || `${documentId}_${lastModified}`,
      version: 1
    });

    // Return blob URL for immediate use
    const blobUrl = URL.createObjectURL(blob);
    return { success: true, blobUrl };

  } catch (error) {
    console.error('Error downloading and caching cover:', error);
    return { success: false, error: 'Failed to download cover image' };
  }
};

/**
 * Try multiple extensions to find and cache a cover
 */
export const findAndCacheCover = async (documentId: string): Promise<CoverBlobResult> => {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  
  for (const ext of extensions) {
    const result = await downloadAndCacheCover(documentId, ext);
    if (result.success) {
      return result;
    }
  }
  
  return { success: false, error: 'No cover image found with any extension' };
};

/**
 * Get cached cover or download if not cached
 */
export const getCachedCover = async (documentId: string): Promise<string | null> => {
  try {
    // Try to get from cache first
    const cachedUrl = await documentStore.getCover(documentId);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Not cached - try to download and cache
    const result = await findAndCacheCover(documentId);
    return result.blobUrl || null;
  } catch (error) {
    console.error('Error getting cached cover:', error);
    return null;
  }
};

/**
 * Update cached cover if it has changed based on server metadata
 */
export const updateCoverIfChanged = async (
  documentId: string, 
  serverLastModified: number,
  serverEtag?: string,
  serverSize?: number
): Promise<boolean> => {
  try {
    const cachedMetadata = await documentStore.getCoverMetadata(documentId);
    
    // If not cached, download it
    if (!cachedMetadata) {
      const result = await findAndCacheCover(documentId);
      return result.success;
    }
    
    // Check if server version is newer or different
    let needsUpdate = false;
    
    if (serverEtag && cachedMetadata.etag !== serverEtag) {
      needsUpdate = true;
      console.log(`Cover needs update - etag changed: ${cachedMetadata.etag} -> ${serverEtag}`);
    } else if (serverLastModified && cachedMetadata.lastModified < serverLastModified) {
      needsUpdate = true;
      console.log(`Cover needs update - timestamp changed: ${cachedMetadata.lastModified} -> ${serverLastModified}`);
    } else if (serverSize && cachedMetadata.size !== serverSize) {
      needsUpdate = true;
      console.log(`Cover needs update - size changed: ${cachedMetadata.size} -> ${serverSize}`);
    }
    
    if (needsUpdate) {
      const result = await findAndCacheCover(documentId);
      return result.success;
    }
    
    return true; // Already up to date
  } catch (error) {
    console.error('Error updating cover cache:', error);
    return false;
  }
};