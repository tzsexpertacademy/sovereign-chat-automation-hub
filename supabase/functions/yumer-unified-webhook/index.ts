import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`🔄 [UNIFIED-WEBHOOK] Redirecionando: ${req.method} ${req.url}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the request body
    const body = req.method === 'POST' ? await req.text() : null
    console.log(`📨 [UNIFIED-WEBHOOK] Redirecionando POST - Body length: ${body?.length || 0}`)

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Redirect to the correct yumer-webhook function
    const { data, error } = await supabase.functions.invoke('yumer-webhook', {
      body: body ? JSON.parse(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (error) {
      console.error('❌ [UNIFIED-WEBHOOK] Erro ao redirecionar:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ [UNIFIED-WEBHOOK] Redirecionamento bem-sucedido')
    return new Response(
      JSON.stringify(data || { success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ [UNIFIED-WEBHOOK] Erro geral:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})