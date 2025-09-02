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

    // Fetch cover information for documents that have covers
    const documentIds = documents?.map(doc => doc.id) || []
    const covers: any[] = []

    if (documentIds.length > 0) {
      // Check which documents have covers in storage
      const { data: coverFiles, error: storageError } = await supabaseClient.storage
        .from('covers')
        .list('', {
          limit: 1000,
        })

      if (!storageError && coverFiles) {
        for (const doc of documents || []) {
          // Check if cover exists for this document
          const coverFile = coverFiles.find(file => 
            file.name.startsWith(doc.id) && 
            (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png') || file.name.endsWith('.webp'))
          )

          if (coverFile) {
            const { data: signedUrlData } = await supabaseClient.storage
              .from('covers')
              .createSignedUrl(coverFile.name, 60 * 60) // 1 hour expiry

            if (signedUrlData?.signedUrl) {
              covers.push({
                documentId: doc.id,
                url: signedUrlData.signedUrl,
                updatedAt: new Date(coverFile.updated_at || coverFile.created_at || Date.now()).getTime(),
                extension: coverFile.name.split('.').pop() || 'jpg',
                size: coverFile.metadata?.size || 0,
                lastModified: new Date(coverFile.updated_at || coverFile.created_at || Date.now()).getTime()
              })
            }
          }
        }
      }
    }

    // Since there's no soft delete tracking, tombstones will be empty for now
    const tombstones: string[] = []
    
    // Check for deleted covers by comparing storage with database
    const deletedCovers: string[] = []
    if (documentIds.length > 0) {
      const { data: allDbDocs } = await supabaseClient
        .from('documents')
        .select('id')
        .in('id', documentIds)
      
      const existingDocIds = new Set(allDbDocs?.map(doc => doc.id) || [])
      
      // Find covers that exist in storage but not in database (deleted documents)
      const { data: allCoverFiles } = await supabaseClient.storage
        .from('covers')
        .list('', { limit: 1000 })
      
      if (allCoverFiles) {
        for (const file of allCoverFiles) {
          const docId = file.name.split('.')[0]
          if (!existingDocIds.has(docId)) {
            deletedCovers.push(docId)
          }
        }
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