
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// ===== INTERFACES PARA HUMANIZAÇÃO =====
interface HumanizedPersonality {
  id: string;
  name: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'empathetic';
  responseDelay: { min: number; max: number };
  typingSpeed: number; // WPM
  reactionProbability: number; // 0-1
}

interface HumanizedConfig {
  enabled: boolean;
  personality: HumanizedPersonality;
  behavior: {
    typing: {
      enabled: boolean;
      minDuration: number;
      maxDuration: number;
    };
    presence: {
      enabled: boolean;
      showTyping: boolean;
    };
    messageHandling: {
      splitLongMessages: boolean;
      maxCharsPerChunk: number;
      delayBetweenChunks: number;
    };
  };
}

// ===== PERSONALIDADES PADRÃO =====
const defaultPersonalities: HumanizedPersonality[] = [
  {
    id: 'friendly-assistant',
    name: 'Assistente Amigável',
    tone: 'friendly',
    responseDelay: { min: 2000, max: 4000 },
    typingSpeed: 45,
    reactionProbability: 0.7
  },
  {
    id: 'professional-support',
    name: 'Suporte Profissional',
    tone: 'professional',
    responseDelay: { min: 1500, max: 3000 },
    typingSpeed: 60,
    reactionProbability: 0.3
  }
];

// ===== CONFIGURAÇÃO HUMANIZADA PADRÃO =====
const defaultHumanizedConfig: HumanizedConfig = {
  enabled: true,
  personality: defaultPersonalities[0],
  behavior: {
    typing: {
      enabled: true,
      minDuration: 1000,
      maxDuration: 5000
    },
    presence: {
      enabled: true,
      showTyping: true
    },
    messageHandling: {
      splitLongMessages: true,
      maxCharsPerChunk: 350,
      delayBetweenChunks: 2500
    }
  }
};

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
    
    const requestBody = await req.json();
    console.log('📋 [AI-ASSISTANT] Body completo recebido:', JSON.stringify(requestBody, null, 2));
    
    const { 
      ticketId, 
      message, 
      messages,
      clientId,
      instanceId,
      assistant,
      context 
    } = requestBody;
    
    // 🔍 LOGS DETALHADOS DOS PARÂMETROS
    console.log('🔍 [AI-ASSISTANT] Parâmetros extraídos:', {
      ticketId: ticketId,
      hasMessage: !!message,
      hasMessages: !!messages,
      messagesLength: messages ? messages.length : 0,
      clientId: clientId,
      instanceId: instanceId,
      assistantId: assistant?.id,
      assistantName: assistant?.name,
      assistantModel: assistant?.model,
      contextCustomerName: context?.customerName,
      contextPhoneNumber: context?.phoneNumber,
      contextChatId: context?.chatId
    });

    // 📝 SUPORTAR BATCHES: Combinar múltiplas mensagens como contexto único
    const isBatch = messages && Array.isArray(messages) && messages.length > 0;
    const messageContent = isBatch
      ? messages.map(msg => `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.content}`).join('\n')
      : message;

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
      messageLength: messageContent?.length || 0,
      isBatch: !!messages,
      batchSize: messages?.length || 1,
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

    // 🎯 CONSTRUIR PROMPT PARA BATCH: Considerar todas as mensagens como contexto único
    const isBatchProcessing = messages && Array.isArray(messages) && messages.length > 1;
    const contextMessage = isBatchProcessing 
      ? `\n\nNOTA IMPORTANTE: O usuário enviou ${messages.length} mensagens em sequência rápida. Estas mensagens devem ser consideradas como uma única conversa contínua. Analise todo o contexto e responda de forma unificada, não responda cada mensagem separadamente.`
      : '';
    
    const systemPrompt = `${assistant.prompt || 'Você é um assistente útil e prestativo.'}

Contexto da conversa:
Cliente: ${context?.customerName || 'Cliente'}
Telefone: ${context?.phoneNumber || 'N/A'}${contextMessage}

Histórico recente da conversa:
${conversationContext}

Instruções importantes:
- Responda de forma natural e humana
- Seja útil e prestativo
- Mantenha o contexto da conversa
- Se não souber algo, seja honesto
- Responda em português brasileiro
- Seja conciso mas completo
${isBatchProcessing ? '- Considere todas as mensagens como uma única solicitação do usuário' : ''}`;

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
          { role: 'user', content: messageContent }
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

    // 🤖 BUSCAR CONFIGURAÇÃO HUMANIZADA DO ASSISTENTE
    const humanizedConfig = await getHumanizedConfig(assistant.id);
    
    // 📤 ENVIAR RESPOSTA VIA SERVIÇO UNIFICADO SIMPLIFICADO
    console.log('📤 [AI-ASSISTANT] Enviando resposta via serviço unificado...');
    
    // Usar yumerApiV2 diretamente com ID correto
    let realInstanceId = instanceId;
    
    // Verificar se é UUID interno e buscar o instance_id real
    if (instanceId.includes('-')) {
      console.log('🔍 [AI-ASSISTANT] Resolvendo ID interno para real:', instanceId);
      
      const { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('id', instanceId)
        .single();
      
      if (instanceError || !instanceData) {
        console.error('❌ [AI-ASSISTANT] Erro ao buscar instance_id real:', instanceError);
        throw new Error(`Instância não encontrada: ${instanceId}`);
      }
      
      realInstanceId = instanceData.instance_id;
      console.log('✅ [AI-ASSISTANT] ID real da instância:', {
        internal: instanceId,
        real: realInstanceId
      });
    }

    // Garantir business token válido
    console.log('🔐 [AI-ASSISTANT] Verificando business token para cliente:', clientId);
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('business_token')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client?.business_token) {
      console.warn('⚠️ [AI-ASSISTANT] Business token não encontrado para cliente:', clientId);
    }

    // Enviar usando yumerApiV2 com o ID correto
    const sendOptions = {
      delay: 1200,
      presence: 'composing',
      externalAttributes: `source=ai-assistant;ticketId=${ticketId};assistantId=${assistant.id};timestamp=${Date.now()}`
    };

    let sendResult;
    try {
      // USAR IMPLEMENTAÇÃO DIRETA PARA EVITAR PROBLEMAS DE IMPORTAÇÃO
      console.log('📤 [AI-ASSISTANT] Enviando via API Yumer v2 diretamente...');
      
      const sendData = {
        recipient: context.chatId,
        textMessage: {
          text: aiResponse
        },
        options: sendOptions
      };

      const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/send/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      sendResult = {
        success: true,
        messageId: result.key?.id || `ai_msg_${Date.now()}`,
        details: result
      };
      
      console.log('✅ [AI-ASSISTANT] Mensagem enviada com sucesso via API direta:', {
        realInstanceId,
        chatId: context.chatId,
        messageId: sendResult.messageId
      });
      
    } catch (sendError: any) {
      console.error('❌ [AI-ASSISTANT] Erro ao enviar via API direta:', sendError);
      
      sendResult = {
        success: false,
        error: sendError.message || 'Erro no envio',
        details: sendError
      };
    }

    // 🔥 CORREÇÃO: Marcar mensagens do usuário como processadas após resposta da IA
    await markUserMessagesAsProcessed(ticketId, context?.chatId);

    console.log('🎉 [AI-ASSISTANT] SUCESSO TOTAL! Assistente processou e enviou resposta:', {
      ticketId: ticketId,
      assistantName: assistant?.name,
      responseLength: aiResponse?.length || 0,
      sendSuccess: sendResult?.success,
      messageId: messageId,
      timestamp: new Date().toISOString()
    });

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

// ===== FUNÇÃO PARA MARCAR MENSAGENS COMO PROCESSADAS =====

// 🔥 Marcar mensagens do usuário como processadas após IA responder
async function markUserMessagesAsProcessed(ticketId: string, chatId?: string) {
  try {
    console.log('🔄 [MARK-PROCESSED] Marcando mensagens como processadas para ticket:', ticketId);
    
    if (chatId) {
      // Buscar mensagens não processadas do usuário no chat específico
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('id, message_id')
        .eq('chat_id', chatId)
        .eq('from_me', false)
        .eq('is_processed', false);
      
      if (messages && messages.length > 0) {
        console.log(`🔄 [MARK-PROCESSED] Encontradas ${messages.length} mensagens para marcar como processadas`);
        
        // Marcar como processadas
        const { error } = await supabase
          .from('whatsapp_messages')
          .update({ 
            is_processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('chat_id', chatId)
          .eq('from_me', false)
          .eq('is_processed', false);
        
        if (error) {
          console.error('❌ [MARK-PROCESSED] Erro ao marcar mensagens:', error);
        } else {
          console.log(`✅ [MARK-PROCESSED] ${messages.length} mensagens marcadas como processadas`);
        }
      }
    }
  } catch (error) {
    console.error('❌ [MARK-PROCESSED] Erro crítico:', error);
  }
}

// ===== FUNÇÕES DE HUMANIZAÇÃO =====

// 🎭 Buscar configuração humanizada do assistente
async function getHumanizedConfig(assistantId: string): Promise<HumanizedConfig> {
  try {
    const { data: assistant } = await supabase
      .from('assistants')
      .select('advanced_settings')
      .eq('id', assistantId)
      .single();

    if (assistant?.advanced_settings) {
      const advancedSettings = typeof assistant.advanced_settings === 'string' 
        ? JSON.parse(assistant.advanced_settings) 
        : assistant.advanced_settings;
      
      if (advancedSettings.humanization) {
        console.log('🎭 [HUMANIZED-CONFIG] Configuração customizada encontrada:', advancedSettings.humanization);
        return { ...defaultHumanizedConfig, ...advancedSettings.humanization };
      }
    }

    console.log('🎭 [HUMANIZED-CONFIG] Usando configuração padrão');
    return defaultHumanizedConfig;
  } catch (error) {
    console.error('❌ [HUMANIZED-CONFIG] Erro ao buscar configuração:', error);
    return defaultHumanizedConfig;
  }
}

// 📝 Dividir mensagem em chunks inteligentes
function splitMessage(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitIndex = maxChars;
    
    // Procurar quebra natural
    const naturalBreaks = ['. ', ', ', '\n', '; ', '! ', '? '];
    for (const breakChar of naturalBreaks) {
      const lastBreak = remaining.lastIndexOf(breakChar, maxChars);
      if (lastBreak > maxChars * 0.5) {
        splitIndex = lastBreak + breakChar.length;
        break;
      }
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

// ⏱️ Calcular duração de typing baseada no texto
function calculateTypingDuration(text: string, typingSpeed: number, config: HumanizedConfig): number {
  const words = text.split(' ').length;
  const baseTypingTime = (words / typingSpeed) * 60 * 1000;
  
  // Aplicar variação natural (80% a 120% do tempo base)
  const duration = baseTypingTime * (0.8 + Math.random() * 0.4);
  
  return Math.max(
    config.behavior.typing.minDuration,
    Math.min(config.behavior.typing.maxDuration, duration)
  );
}

// 📤 Enviar resposta humanizada via CodeChat v2.2.1
async function sendHumanizedResponse(
  instanceId: string, 
  chatId: string, 
  message: string, 
  config: HumanizedConfig
): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    if (!config.enabled) {
      // Fallback para envio simples se humanização desabilitada
      const result = await sendSimpleMessage(instanceId, chatId, message);
      return { success: result.success, chunks: 1, error: result.error };
    }

    console.log('🤖 [HUMANIZED-SEND] Iniciando envio humanizado:', {
      instanceId,
      chatId,
      messageLength: message.length,
      personality: config.personality.name,
      splitEnabled: config.behavior.messageHandling.splitLongMessages
    });

    // 1. Dividir mensagem em chunks se necessário
    const chunks = config.behavior.messageHandling.splitLongMessages 
      ? splitMessage(message, config.behavior.messageHandling.maxCharsPerChunk)
      : [message];

    console.log(`📝 [HUMANIZED-SEND] Dividido em ${chunks.length} chunks`);

    // 2. Buscar token de autenticação
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select(`
        instance_id,
        client_id,
        yumer_instance_name,
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.error('❌ [HUMANIZED-SEND] Business token não encontrado para instância:', instanceId);
      return { success: false, chunks: 0, error: 'Business token not found' };
    }

    let businessToken = instanceData.clients.business_token;

    // 🔑 VERIFICAR SE O TOKEN ESTÁ VÁLIDO (NÃO EXPIRADO)
    try {
      const tokenParts = businessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const expirationTime = payload.exp * 1000;
        const currentTime = Date.now();

        if (currentTime >= expirationTime) {
          console.warn('⚠️ [HUMANIZED-SEND] Token expirado, regenerando...');
          
          // Regenerar token
          if (instanceData.yumer_instance_name) {
            const jose = await import('jose');
            const jwtSecret = Deno.env.get('AUTHENTICATION_JWT_SECRET') || 'your-secret-key';
            
            const now = Math.floor(Date.now() / 1000);
            const exp = now + (4 * 60 * 60); // 4 horas
            
            const newPayload = {
              instanceName: instanceData.yumer_instance_name,
              apiName: "whatsapp-api",
              tokenId: crypto.randomUUID(),
              iat: now,
              exp: exp,
              sub: "g-t"
            };
            
            const secret = new TextEncoder().encode(jwtSecret);
            businessToken = await new jose.SignJWT(newPayload)
              .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
              .setIssuedAt(now)
              .setExpirationTime(exp)
              .setSubject('g-t')
              .sign(secret);

            // Salvar o novo token no banco
            await supabase
              .from('clients')
              .update({ business_token: businessToken })
              .eq('id', instanceData.client_id);

            console.log('✅ [HUMANIZED-SEND] Token regenerado com sucesso');
          }
        }
      }
    } catch (tokenError) {
      console.warn('⚠️ [HUMANIZED-SEND] Erro ao verificar token:', tokenError);
    }

    // 3. Enviar cada chunk com comportamento humanizado
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`📤 [HUMANIZED-SEND] Enviando chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..."`);

      // 3a. Detectar se é mensagem de áudio
      const isAudioMessage = chunk.toLowerCase().includes('audio:') || chunk.toLowerCase().includes('.ogg') || chunk.toLowerCase().includes('.oga');
      const presenceType: 'composing' | 'recording' = isAudioMessage ? 'recording' : 'composing';

      // 3b. Simular typing/recording se habilitado
      if (config.behavior.typing.enabled && config.behavior.presence.showTyping) {
        const typingDuration = calculateTypingDuration(chunk, config.personality.typingSpeed, config);
        console.log(`⌨️ [HUMANIZED-SEND] Simulando ${presenceType} por ${typingDuration}ms`);
        
        // Aguardar tempo de typing/recording ANTES de enviar
        await new Promise(resolve => setTimeout(resolve, typingDuration));
      }

      // 3c. Enviar mensagem real via CodeChat v2.2.1 com presença aplicada
      const presenceToUse = (config.behavior.typing.enabled && config.behavior.presence.showTyping) ? presenceType : 'available';
      const chunkResult = await sendCodeChatMessage(instanceId, chatId, chunk, businessToken, presenceToUse);
      
      if (!chunkResult.success) {
        console.error(`❌ [HUMANIZED-SEND] Erro no chunk ${i + 1}:`, chunkResult.error);
        return { success: false, chunks: i, error: chunkResult.error };
      }

      // 3c. Delay entre chunks (exceto no último)
      if (i < chunks.length - 1) {
        const chunkDelay = config.behavior.messageHandling.delayBetweenChunks + 
          (Math.random() - 0.5) * 1000; // ±500ms de variação
        console.log(`⏱️ [HUMANIZED-SEND] Aguardando ${chunkDelay}ms antes do próximo chunk`);
        await new Promise(resolve => setTimeout(resolve, chunkDelay));
      }
    }

    // 4. Não precisamos mais definir presença separadamente - integrada na mensagem

    console.log(`✅ [HUMANIZED-SEND] Todos os ${chunks.length} chunks enviados com sucesso`);
    return { success: true, chunks: chunks.length };

  } catch (error) {
    console.error('❌ [HUMANIZED-SEND] Erro no envio humanizado:', error);
    return { 
      success: false, 
      chunks: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// 📤 Enviar mensagem via CodeChat v2.2.1 com presença integrada
async function sendCodeChatMessage(
  instanceId: string, 
  chatId: string, 
  message: string, 
  businessToken: string,
  presence: 'available' | 'composing' | 'recording' = 'available'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Se a mensagem estiver vazia, não enviar nada (CodeChat v2.2.1 não aceita mensagens vazias)
    if (!message || message.trim() === '') {
      console.log(`⚠️ [CODECHAT-SEND] Pulando envio de mensagem vazia com presença: ${presence}`);
      return { success: true };
    }

    const codeChatData = {
      recipient: chatId,
      textMessage: {
        text: message
      },
      options: {
        delay: 0, // Controlamos o delay manualmente
        presence: presence // Integrar presença diretamente na mensagem
      }
    };

    console.log('📋 [CODECHAT-SEND] Dados para CodeChat v2.2.1:', {
      recipient: chatId,
      textLength: message.length,
      presence: presence
    });

    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(codeChatData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat v2.2.1:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        instanceId,
        url: `https://api.yumer.com.br/api/v2/instance/${instanceId}/send/text`
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('✅ [CODECHAT-SEND] Mensagem enviada com sucesso via CodeChat v2.2.1:', {
      messageId: result.messageId,
      chatId: chatId,
      presence: presence
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [CODECHAT-SEND] Erro ao enviar via CodeChat v2.2.1:', error);
    return { success: false, error: error.message };
  }
}

// 👤 Função de presença removida - agora integrada nas options da mensagem
// A presença agora é controlada via options.presence em cada mensagem enviada

// 📤 Envio simples (fallback)
async function sendSimpleMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📤 [SIMPLE-SEND] Enviando mensagem simples:', {
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
        yumer_instance_name,
        clients:client_id (
          business_token
        )
      `)
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData?.clients?.business_token) {
      console.error('❌ [SIMPLE-SEND] Business token não encontrado para instância:', instanceId);
      return { success: false, error: 'Business token not found' };
    }

    let businessToken = instanceData.clients.business_token;

    // 🔑 VERIFICAR SE O TOKEN ESTÁ VÁLIDO (NÃO EXPIRADO)
    try {
      const tokenParts = businessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const expirationTime = payload.exp * 1000;
        const currentTime = Date.now();

        if (currentTime >= expirationTime) {
          console.warn('⚠️ [SIMPLE-SEND] Token expirado, regenerando...');
          
          // Regenerar token se expirado
          if (instanceData.yumer_instance_name) {
            const jose = await import('jose');
            const jwtSecret = Deno.env.get('AUTHENTICATION_JWT_SECRET') || 'your-secret-key';
            
            const now = Math.floor(Date.now() / 1000);
            const exp = now + (4 * 60 * 60); // 4 horas
            
            const newPayload = {
              instanceName: instanceData.yumer_instance_name,
              apiName: "whatsapp-api",
              tokenId: crypto.randomUUID(),
              iat: now,
              exp: exp,
              sub: "g-t"
            };
            
            const secret = new TextEncoder().encode(jwtSecret);
            businessToken = await new jose.SignJWT(newPayload)
              .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
              .setIssuedAt(now)
              .setExpirationTime(exp)
              .setSubject('g-t')
              .sign(secret);

            // Salvar o novo token no banco
            await supabase
              .from('clients')
              .update({ business_token: businessToken })
              .eq('id', instanceData.client_id);

            console.log('✅ [SIMPLE-SEND] Token regenerado com sucesso');
          }
        }
      }
    } catch (tokenError) {
      console.warn('⚠️ [SIMPLE-SEND] Erro ao verificar token:', tokenError);
    }

    return await sendCodeChatMessage(instanceId, chatId, message, businessToken);

  } catch (error) {
    console.error('❌ [SIMPLE-SEND] Erro no envio simples:', error);
    return { success: false, error: error.message };
  }
}
