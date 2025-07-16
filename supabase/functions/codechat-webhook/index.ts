import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QRCodeWebhookData {
  event: string;
  instance: {
    name: string;
    id: number;
  };
  date: {
    qrcode?: {
      code: string;
      base64: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📨 [WEBHOOK] Recebendo webhook:', req.method, req.url);
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = req.headers.get('content-type');
    console.log('📋 [WEBHOOK] Content-Type:', contentType);

    let webhookData: QRCodeWebhookData;

    // Parse different content types
    if (contentType?.includes('application/json')) {
      webhookData = await req.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const dataStr = formData.get('data') as string;
      webhookData = JSON.parse(dataStr);
    } else {
      const text = await req.text();
      console.log('📋 [WEBHOOK] Raw text:', text);
      
      try {
        webhookData = JSON.parse(text);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('📨 [WEBHOOK] Dados recebidos:', JSON.stringify(webhookData, null, 2));

    // Verificar se é webhook de QR Code
    if (webhookData.event === 'qrcode.updated') {
      console.log('🎯 [WEBHOOK] QR Code webhook detectado');
      
      const instanceName = webhookData.instance?.name;
      const qrCode = webhookData.date?.qrcode?.base64;
      
      if (!instanceName) {
        console.warn('⚠️ [WEBHOOK] Nome da instância não encontrado');
        return new Response(
          JSON.stringify({ error: 'Instance name not found' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!qrCode) {
        console.warn('⚠️ [WEBHOOK] QR Code não encontrado no webhook');
        return new Response(
          JSON.stringify({ error: 'QR Code not found' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ [WEBHOOK] QR Code recebido para instância: ${instanceName}`);
      console.log(`📊 [WEBHOOK] QR Code tamanho: ${qrCode.length} caracteres`);

      // Aqui você pode processar o QR Code:
      // 1. Salvar no banco de dados
      // 2. Enviar para WebSocket
      // 3. Notificar via Server-Sent Events
      // 4. Armazenar em cache (Redis, etc.)

      // Por enquanto, apenas loggar sucesso
      console.log(`🎉 [WEBHOOK] Webhook processado com sucesso`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'QR Code webhook processed',
          instanceName,
          timestamp: new Date().toISOString()
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Outros tipos de webhook
    console.log(`📋 [WEBHOOK] Webhook recebido: ${webhookData.event}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received',
        event: webhookData.event
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro ao processar webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});