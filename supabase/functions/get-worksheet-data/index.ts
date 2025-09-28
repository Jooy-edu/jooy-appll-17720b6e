import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { worksheetId } = await req.json()

    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'Worksheet ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch document metadata from 'documents' table
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', worksheetId)
      .single()

    if (documentError) {
      console.error('Document fetch error:', documentError)
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get PDF URL from 'pdfs' storage bucket with 24 hour expiry
    const { data: pdfData, error: storageError } = await supabase.storage
      .from('pdfs')
      .createSignedUrl(`${worksheetId}.pdf`, 86400) // 24 hours expiry

    let pdfUrl = null
    if (pdfData?.signedUrl && !storageError) {
      pdfUrl = pdfData.signedUrl
    }

    // If no signed URL could be generated, pdfUrl remains null
    if (!pdfUrl) {
      console.warn(`PDF file not found in storage for worksheet: ${worksheetId}`)
      return new Response(
        JSON.stringify({ error: 'PDF file not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if document has metadata and determine mode
    let responseData
    
    if (document.metadata && document.metadata.mode === 'auto') {
      // Auto Mode: Use metadata from documents table
      const autoModeData = document.metadata.data || []
      
      // Helper function to normalize guidance items
      const normalizeGuidance = (guidance: any[], pageNumber: number): any[] => {
        if (!guidance) return []
        return guidance.map((guidanceItem: any, index: number) => ({
          ...guidanceItem,
          title: guidanceItem.title || 'Untitled Guidance',
          description: Array.isArray(guidanceItem.description) 
            ? guidanceItem.description.map((desc: any) => typeof desc === 'string' ? desc.trim() : '').filter((desc: any) => desc !== '')
            : typeof guidanceItem.description === 'string' 
              ? guidanceItem.description.split('\n').map((desc: string) => desc.trim()).filter((desc: string) => desc !== '')
              : [],
          audioName: guidanceItem.audioName || `${pageNumber}_${index + 1}`
        }))
      }

      // Process guidance descriptions to ensure they are arrays of paragraphs
      const processedAutoModeData = autoModeData.map((pageData: any) => ({
        ...pageData,
        guidance: normalizeGuidance(pageData.guidance, pageData.page_number),
        parent_guidance: normalizeGuidance(pageData.parent_guidance || pageData.parentGuidance, pageData.page_number)
      }))
      
      console.log(`Successfully processed worksheet: ${worksheetId}, auto mode data:`, JSON.stringify(processedAutoModeData, null, 2))
      
      responseData = {
        meta: {
          mode: 'auto',
          documentName: document.name,
          documentId: document.id,
          drmProtectedPages: document.drm_protected_pages || [],
          data: processedAutoModeData
        },
        pdfUrl
      }
    } else {
      // Regions Mode: First try to fetch regions from document_regions table
      const { data: regions, error: regionsError } = await supabase
        .from('document_regions')
        .select('*')
        .eq('document_id', worksheetId)
        .order('page', { ascending: true })

      let transformedRegions = []
      
      if (!regionsError && regions && regions.length > 0) {
        // Transform regions data to match expected format
        transformedRegions = regions.map(region => ({
          id: region.id,
          document_id: document.id,
          user_id: region.user_id,
          page: region.page,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          type: region.type,
          name: region.name,
          description: region.description || [],
          created_at: region.created_at
        }))
      } else {
        // Fallback: Try to get JSON data from 'data' storage bucket
        try {
          const { data: jsonData, error: storageError } = await supabase.storage
            .from('data')
            .download(`${worksheetId}.json`)

          if (!storageError && jsonData) {
            const jsonText = await jsonData.text()
            const jsonContent = JSON.parse(jsonText)
            
            // Transform JSON data to regions format
            if (jsonContent.regions) {
              transformedRegions = jsonContent.regions.map((region: any) => ({
                id: region.id,
                document_id: document.id,
                user_id: region.user_id,
                page: region.page || region.pageNumber,
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
                type: region.type,
                name: region.name,
                description: region.description || [],
                created_at: region.created_at
              }))
            }
          }
        } catch (storageError) {
          console.log('Storage fallback failed:', storageError)
        }
      }

      responseData = {
        meta: {
          mode: 'regions',
          documentName: document.name,
          documentId: document.id,
          drmProtectedPages: document.drm_protected_pages || [],
          regions: transformedRegions
        },
        pdfUrl
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})