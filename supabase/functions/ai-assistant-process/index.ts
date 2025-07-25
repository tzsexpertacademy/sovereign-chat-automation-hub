
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const globalOpenAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 [AI-ASSISTANT] Processando requisição');
    
    const { 
      ticketId, 
      message, 
      clientId, 
      instanceId,
      assistant,
      context 
    } = await req.json();

    // 🔑 PRIORIZAÇÃO DE API KEYS: Cliente específico > Global
    let openAIApiKey = globalOpenAIApiKey;
    let keySource = 'global';

    try {
      // Tentar buscar API Key específica do cliente
      const { data: clientConfig } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key, default_model')
        .eq('client_id', clientId)
        .single();

      if (clientConfig?.openai_api_key) {
        openAIApiKey = clientConfig.openai_api_key;
        keySource = 'client';
        console.log('🔑 [AI-ASSISTANT] Usando API Key específica do cliente');
      } else {
        console.log('🔑 [AI-ASSISTANT] Cliente não tem API Key própria, usando global');
      }
    } catch (error) {
      console.log('🔑 [AI-ASSISTANT] Erro ao buscar config do cliente, usando global:', error.message);
    }

    console.log('🤖 [AI-ASSISTANT] Dados recebidos:', {
      ticketId,
      instanceId,
      assistantName: assistant?.name,
      messageLength: message?.length || 0,
      customerName: context?.customerName,
      keySource,
      hasOpenAIKey: !!openAIApiKey
    });

    // Verificar se OpenAI API key está configurada
    if (!openAIApiKey) {
      console.error('❌ [AI-ASSISTANT] OpenAI API key não configurada');
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          message: keySource === 'client' 
            ? 'Cliente precisa configurar sua API Key da OpenAI'
            : 'Configure OPENAI_API_KEY global nas Edge Function Secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar histórico recente de mensagens do ticket para contexto
    const { data: recentMessages } = await supabase
      .from('ticket_messages')
      .select('content, from_me, sender_name, timestamp')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Construir contexto da conversa
    let conversationContext = '';
    if (recentMessages && recentMessages.length > 0) {
      conversationContext = recentMessages
        .reverse() // Ordenar cronologicamente
        .map(msg => `${msg.from_me ? 'Assistente' : msg.sender_name}: ${msg.content}`)
        .join('\n');
    }

    // Construir prompt do assistente
    const systemPrompt = `${assistant.prompt || 'Você é um assistente útil e prestativo.'}

Contexto da conversa:
Cliente: ${context?.customerName || 'Cliente'}
Telefone: ${context?.phoneNumber || 'N/A'}

Histórico recente da conversa:
${conversationContext}

Instruções importantes:
- Responda de forma natural e humana
- Seja útil e prestativo
- Mantenha o contexto da conversa
- Se não souber algo, seja honesto
- Responda em português brasileiro
- Seja conciso mas completo`;

    console.log('🤖 [AI-ASSISTANT] Chamando OpenAI API com modelo:', assistant.model || 'gpt-4o-mini');

    // Chamar OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assistant.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AI-ASSISTANT] Erro na OpenAI API:', response.status, response.statusText, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('✅ [AI-ASSISTANT] Resposta da IA gerada:', {
      responseLength: aiResponse?.length || 0,
      model: assistant.model || 'gpt-4o-mini'
    });

    // Salvar resposta da IA no ticket
    const messageId = `ai_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: saveError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_id: messageId,
        content: aiResponse,
        from_me: true,
        is_ai_response: true,
        sender_name: assistant.name || 'Assistente IA',
        timestamp: new Date().toISOString(),
        processing_status: 'processed'
      });

    if (saveError) {
      console.error('❌ [AI-ASSISTANT] Erro ao salvar resposta:', saveError);
      throw saveError;
    }

    console.log('💾 [AI-ASSISTANT] Resposta salva no ticket');

    // 📤 ENVIAR RESPOSTA VIA YUMER API
    const sendResult = await sendResponseViaYumer(instanceId, context?.chatId, aiResponse);
    if (sendResult.success) {
      console.log('✅ [AI-ASSISTANT] Resposta enviada via YUMER com sucesso');
    } else {
      console.error('❌ [AI-ASSISTANT] Erro ao enviar via YUMER:', sendResult.error);
    }

    console.log('✅ [AI-ASSISTANT] Processamento completo');

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        messageId: messageId,
        timestamp: new Date().toISOString(),
        sentViaYumer: sendResult.success
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [AI-ASSISTANT] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process AI assistant request',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// 📤 Função para enviar resposta via YUMER API
async function sendResponseViaYumer(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📤 [YUMER-SEND] Enviando resposta via YUMER API:', {
      instanceId,
      chatId,
      messageLength: message.length
    });

    // Buscar token de autenticação da instância
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('auth_token, yumer_instance_name')
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.auth_token) {
      console.error('❌ [YUMER-SEND] Token de autenticação não encontrado para instância:', instanceId);
      return { success: false, error: 'Auth token not found' };
    }

    const yumerInstanceName = instanceData.yumer_instance_name || instanceId;
    console.log('🔧 [YUMER-SEND] Usando instância YUMER:', yumerInstanceName);

    // Chamar API YUMER para enviar mensagem
    const yumerResponse = await fetch(`https://yumer.yumerflow.app:8083/message/sendText/${yumerInstanceName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instanceData.auth_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: chatId,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      })
    });

    if (!yumerResponse.ok) {
      const errorText = await yumerResponse.text();
      console.error('❌ [YUMER-SEND] Erro ao enviar via YUMER:', yumerResponse.status, yumerResponse.statusText, errorText);
      return { success: false, error: `HTTP ${yumerResponse.status}: ${errorText}` };
    }

    const result = await yumerResponse.json();
    console.log('✅ [YUMER-SEND] Mensagem enviada com sucesso via YUMER:', {
      messageId: result.keyId,
      chatId: chatId
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [YUMER-SEND] Erro ao enviar via YUMER:', error);
    return { success: false, error: error.message };
  }
}
