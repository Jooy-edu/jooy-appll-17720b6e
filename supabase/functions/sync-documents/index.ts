import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { since = 0 } = await req.json()
    const sinceDate = new Date(since).toISOString()
    
    console.log(`Syncing documents since: ${sinceDate}`)

    // Get current user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    // Fetch documents created since the given timestamp
    const { data: documents, error: docsError } = await supabaseClient
      .from('documents')
      .select('*')
      .gte('created_at', sinceDate)
      .or(`user_id.eq.${user.id},is_private.eq.false`)
      .order('created_at', { ascending: true })

    if (docsError) {
      throw new Error(`Failed to fetch documents: ${docsError.message}`)
    }

    // Enhanced cover information fetch with change detection
    const documentIds = documents?.map(doc => doc.id) || []
    const covers: any[] = []
    const deletedCovers: string[] = []

    if (documentIds.length > 0) {
      // Get all cover files from storage
      const { data: coverFiles, error: storageError } = await supabaseClient.storage
        .from('covers')
        .list('', {
          limit: 1000,
          sortBy: { column: 'updated_at', order: 'desc' }
        })

      if (!storageError && coverFiles) {
        // Process covers for each document
        for (const doc of documents || []) {
          const docCoverFiles = coverFiles.filter(file => 
            file.name.startsWith(doc.id) && 
            (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || 
             file.name.endsWith('.png') || file.name.endsWith('.webp'))
          )

          if (docCoverFiles.length > 0) {
            // Use the most recently updated cover file
            const latestCover = docCoverFiles[0]
            
            // Generate signed URL for downloading
            const { data: signedUrlData } = await supabaseClient.storage
              .from('covers')
              .createSignedUrl(latestCover.name, 60 * 60) // 1 hour expiry

            if (signedUrlData?.signedUrl) {
              const coverInfo = {
                documentId: doc.id,
                url: signedUrlData.signedUrl,
                fileName: latestCover.name,
                updatedAt: new Date(latestCover.updated_at || latestCover.created_at || Date.now()).getTime(),
                extension: latestCover.name.split('.').pop() || 'jpg',
                size: latestCover.metadata?.size || 0,
                lastModified: new Date(latestCover.updated_at || latestCover.created_at || Date.now()).getTime(),
                etag: latestCover.metadata?.eTag || `${latestCover.id}_${latestCover.updated_at}`,
                version: latestCover.metadata?.httpStatusCode || 1
              }
              
              // Only include covers that have been updated since the sync timestamp
              const coverUpdateTime = coverInfo.updatedAt
              const syncTime = new Date(since).getTime()
              
              if (coverUpdateTime >= syncTime) {
                covers.push(coverInfo)
              }
            }
          }
        }

        // Find orphaned cover files (covers without corresponding documents)
        const allDocIds = new Set(documents?.map(doc => doc.id) || [])
        for (const file of coverFiles) {
          const docId = file.name.split('.')[0]
          if (!allDocIds.has(docId)) {
            deletedCovers.push(docId)
          }
        }
      }
    }

    // Check for deleted documents (tombstones) by comparing with previous sync
    const tombstones: string[] = []
    
    // Additional check for recently deleted documents if we have a proper since timestamp
    if (since > 0) {
      try {
        // We can't easily detect deleted documents without a tombstone table
        // This would require a separate tracking mechanism
        // For now, we'll rely on the deletedCovers detection above
      } catch (error) {
        console.warn('Could not check for deleted documents:', error)
      }
    }

    const currentTimestamp = Date.now()

    return new Response(
      JSON.stringify({
        documents: documents || [],
        covers,
        deletedCovers,
        lastUpdated: currentTimestamp,
        tombstones,
        syncedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        documents: [],
        covers: [],
        deletedCovers: [],
        lastUpdated: Date.now(),
        tombstones: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})