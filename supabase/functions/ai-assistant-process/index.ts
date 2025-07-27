
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const globalOpenAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Sistema de controle de duplicação
const processingLocks = new Map<string, { timestamp: number; promise: Promise<any> }>();
const LOCK_TIMEOUT = 30000; // 30 segundos

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

    // 🔒 CONTROLE DE DUPLICAÇÃO: Verificar se já está sendo processado
    const lockKey = `${ticketId}_${message?.slice(0, 50)}`;
    const existingLock = processingLocks.get(lockKey);
    
    if (existingLock) {
      const elapsed = Date.now() - existingLock.timestamp;
      if (elapsed < LOCK_TIMEOUT) {
        console.log('⏳ [AI-ASSISTANT] Requisição já sendo processada, ignorando duplicata');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Mensagem já sendo processada',
            duplicate: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('🧹 [AI-ASSISTANT] Lock expirado, removendo...');
        processingLocks.delete(lockKey);
      }
    }

    // 🔍 VERIFICAR SE MENSAGEM JÁ FOI PROCESSADA
    const { data: existingMessage } = await supabase
      .from('ticket_messages')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('content', message)
      .eq('is_ai_response', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingMessage) {
      console.log('🔄 [AI-ASSISTANT] Mensagem já processada anteriormente');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Mensagem já foi processada',
          alreadyProcessed: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 🔒 CRIAR LOCK para este processamento
    const processingPromise = processAIResponseWithHumanization(instanceId, context?.chatId, aiResponse, assistant);
    processingLocks.set(lockKey, { timestamp: Date.now(), promise: processingPromise });

    try {
      const sendResult = await processingPromise;
      
      // Limpar lock após processamento
      processingLocks.delete(lockKey);
      
      console.log('✅ [AI-ASSISTANT] Processamento completo');

      return new Response(
        JSON.stringify({
          success: true,
          response: aiResponse,
          messageId: messageId,
          timestamp: new Date().toISOString(),
          sentViaCodeChat: sendResult.success
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      // Limpar lock em caso de erro
      processingLocks.delete(lockKey);
      throw error;
    }

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

// 📤 Função para enviar resposta via CodeChat v2.2.1
async function sendResponseViaCodeChat(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📤 [CODECHAT-SEND] Enviando resposta via CodeChat v2.2.1:', {
      instanceId,
      chatId,
      messageLength: message.length
    });

    // Buscar business_token da instância via cliente
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select(`
        instance_id,
        client_id,
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.error('❌ [CODECHAT-SEND] Business token não encontrado para instância:', instanceId);
      return { success: false, error: 'Business token not found' };
    }

    const businessToken = instanceData.clients.business_token;
    console.log('🔧 [CODECHAT-SEND] Usando CodeChat v2.2.1 para instância:', instanceId);

    // ENDPOINT CORRETO: v2.2.1 usa /api/v2/instance/:instanceId/send/text
    const endpoint = `https://api.yumer.com.br/api/v2/instance/${instanceId}/send/text`;
    
    // Preparar dados para CodeChat v2.2.1 - ESTRUTURA CORRETA
    const codeChatData = {
      number: chatId,
      text: message,
      options: {
        delay: 1200,
        presence: 'composing'
      }
    };

    console.log('📋 [CODECHAT-SEND] Dados para CodeChat API v2.2.1:', {
      endpoint,
      data: codeChatData
    });

    // Chamar CodeChat v2.2.1 com endpoint e headers corretos
    const codeChatResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(codeChatData)
    });

    if (!codeChatResponse.ok) {
      const errorText = await codeChatResponse.text();
      console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat API v2.2.1:', {
        status: codeChatResponse.status,
        statusText: codeChatResponse.statusText,
        error: errorText,
        instanceId,
        endpoint
      });
      return { success: false, error: `HTTP ${codeChatResponse.status}: ${errorText}` };
    }

    const result = await codeChatResponse.json();
    console.log('✅ [CODECHAT-SEND] Mensagem enviada com sucesso via CodeChat v2.2.1:', {
      messageId: result.key?.id,
      chatId: chatId,
      response: result
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat v2.2.1:', error);
    return { success: false, error: error.message };
  }
}

// 🤖 Função para processar resposta da IA com humanização
async function processAIResponseWithHumanization(instanceId: string, chatId: string, message: string, assistant: any): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🎭 [HUMANIZATION] Iniciando processamento humanizado...');
    
    // Implementar presence 'composing' antes de enviar
    await setPresence(instanceId, chatId, 'composing');
    
    // Calcular delay baseado no tamanho da mensagem (simular tempo de digitação)
    const typingDelay = calculateTypingDelay(message);
    console.log(`⏱️ [HUMANIZATION] Simulando digitação por ${typingDelay}ms`);
    
    // Aguardar delay de digitação
    await new Promise(resolve => setTimeout(resolve, typingDelay));
    
    // Dividir mensagem em chunks se necessário
    const messageChunks = splitMessageIntelligently(message);
    
    if (messageChunks.length > 1) {
      console.log(`📝 [HUMANIZATION] Enviando mensagem em ${messageChunks.length} partes`);
      
      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i];
        const isLast = i === messageChunks.length - 1;
        
        // Enviar chunk
        const result = await sendResponseViaCodeChat(instanceId, chatId, chunk);
        if (!result.success) {
          return result;
        }
        
        // Delay entre chunks (exceto no último)
        if (!isLast) {
          const interChunkDelay = Math.random() * 1000 + 500; // 500-1500ms
          console.log(`⏱️ [HUMANIZATION] Aguardando ${interChunkDelay}ms entre chunks`);
          await new Promise(resolve => setTimeout(resolve, interChunkDelay));
        }
      }
    } else {
      // Enviar mensagem única
      const result = await sendResponseViaCodeChat(instanceId, chatId, message);
      if (!result.success) {
        return result;
      }
    }
    
    // Definir presence como 'available' após envio
    await setPresence(instanceId, chatId, 'available');
    
    console.log('✅ [HUMANIZATION] Processamento humanizado concluído');
    return { success: true };
    
  } catch (error) {
    console.error('❌ [HUMANIZATION] Erro no processamento humanizado:', error);
    return { success: false, error: error.message };
  }
}

// 🎭 Função para definir presence via CodeChat v2.2.1
async function setPresence(instanceId: string, chatId: string, presence: 'available' | 'composing' | 'unavailable'): Promise<void> {
  try {
    // Buscar business_token
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select(`
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.warn('⚠️ [PRESENCE] Business token não encontrado para presence');
      return;
    }

    const businessToken = instanceData.clients.business_token;
    
    // ENDPOINT CORRETO: v2.2.1 usa /api/v2/instance/:instanceId/send/presence
    const endpoint = `https://api.yumer.com.br/api/v2/instance/${instanceId}/send/presence`;
    
    const presenceData = {
      number: chatId,
      presence: presence
    };

    console.log('🎭 [PRESENCE] Enviando presence via CodeChat v2.2.1:', {
      endpoint,
      presence,
      chatId
    });

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(presenceData)
    });

    console.log(`🎭 [PRESENCE] Status definido para: ${presence}`);
  } catch (error) {
    console.warn('⚠️ [PRESENCE] Erro ao definir presence via CodeChat v2.2.1:', error.message);
  }
}

// ⏱️ Função para calcular delay de digitação realista
function calculateTypingDelay(message: string): number {
  // Simular velocidade de digitação humana (40-60 palavras por minuto)
  const words = message.split(' ').length;
  const baseDelay = words * 200; // ~50 WPM
  const variation = baseDelay * 0.3; // 30% de variação
  const randomVariation = (Math.random() - 0.5) * variation;
  
  // Limites mínimo e máximo
  const delay = Math.max(1000, Math.min(8000, baseDelay + randomVariation));
  
  return Math.round(delay);
}

// 📝 Função para dividir mensagem inteligentemente
function splitMessageIntelligently(message: string): string[] {
  const maxLength = 160; // Limite típico do WhatsApp
  
  if (message.length <= maxLength) {
    return [message];
  }
  
  // Dividir por frases primeiro
  const sentences = message.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Frase muito longa, dividir por palavras
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if ((wordChunk + ' ' + word).length > maxLength) {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              chunks.push(word); // Palavra muito longa
            }
          } else {
            wordChunk = wordChunk ? wordChunk + ' ' + word : word;
          }
        }
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}
