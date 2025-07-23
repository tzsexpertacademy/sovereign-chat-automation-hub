import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CODECHAT_API_BASE = 'https://api.yumer.com.br'

serve(async (req) => {
  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Responder preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extrair o path da URL
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').slice(2) // Remove '/functions/codechat-v2-proxy'
    const targetPath = pathSegments.join('/')
    const targetUrl = `${CODECHAT_API_BASE}/${targetPath}${url.search}`

    console.log(`🔄 [PROXY] ${req.method} ${targetUrl}`)

    // Copiar headers da requisição original (exceto host)
    const requestHeaders = new Headers()
    for (const [key, value] of req.headers.entries()) {
      if (key.toLowerCase() !== 'host') {
        requestHeaders.set(key, value)
      }
    }

    // Fazer a requisição para a API CodeChat
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
    })

    // Copiar headers da resposta
    const responseHeaders = new Headers(corsHeaders)
    for (const [key, value] of response.headers.entries()) {
      if (!corsHeaders[key]) {
        responseHeaders.set(key, value)
      }
    }

    // Retornar a resposta
    const responseBody = await response.arrayBuffer()
    
    console.log(`✅ [PROXY] ${response.status} ${targetUrl}`)
    
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('❌ [PROXY] Erro:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Proxy error', 
        message: error.message 
      }), 
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})