import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  console.log('🧪 [TEST-AI-VIDEO] Iniciando teste da edge function ai-assistant-process');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      console.log('🧪 [TEST-AI-VIDEO] Testando comando "video testeoficial"...');
      
      // Dados do teste
      const testTicketId = 'abfb4cab-9823-4c00-ab42-a1640fc3cd96';
      const testMessage = 'video testeoficial';
      
      console.log('🧪 [TEST-AI-VIDEO] Chamando ai-assistant-process com dados do teste...');
      
      const aiResponse = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          ticketId: testTicketId,
          messages: [{
            content: testMessage,
            messageId: 'test_' + Date.now(),
            timestamp: new Date().toISOString(),
            customerName: 'Thalis Zulianello Silva',
            phoneNumber: '554796451886'
          }],
          context: {
            chatId: '554796451886@s.whatsapp.net',
            customerName: 'Thalis Zulianello Silva',
            phoneNumber: '554796451886',
            manualTest: true
          }
        }
      });

      console.log('🧪 [TEST-AI-VIDEO] Resultado da chamada da AI:', {
        success: !aiResponse.error,
        hasError: !!aiResponse.error,
        errorDetails: aiResponse.error,
        data: aiResponse.data
      });

      if (aiResponse.error) {
        console.error('🧪 [TEST-AI-VIDEO] ❌ ERRO na edge function:', aiResponse.error);
        return new Response(JSON.stringify({
          success: false,
          error: aiResponse.error,
          message: 'Falha ao chamar ai-assistant-process'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('🧪 [TEST-AI-VIDEO] ✅ SUCESSO! Edge function processou o comando de vídeo');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Teste executado com sucesso',
        result: aiResponse.data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('🧪 [TEST-AI-VIDEO] ❌ ERRO CRÍTICO no teste:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({
    message: 'Test AI Video Command Function',
    usage: 'POST to test video command processing'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});