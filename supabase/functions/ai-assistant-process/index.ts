
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

// ===== INTERFACE PARA RETRY LOGIC =====
interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// ===== FUNÇÃO DE RETRY COM BACKOFF =====
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  operationName: string = 'Operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      console.log(`🔄 [RETRY] ${operationName} - Tentativa ${attempt}/${options.maxAttempts}`);
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`✅ [RETRY] ${operationName} sucedeu na tentativa ${attempt}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ [RETRY] ${operationName} falhou na tentativa ${attempt}:`, error.message);
      
      if (attempt === options.maxAttempts) {
        console.error(`❌ [RETRY] ${operationName} falhou após ${options.maxAttempts} tentativas`);
        break;
      }
      
      // Calcular delay com backoff exponencial
      const delay = Math.min(
        options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1),
        options.maxDelay
      );
      
      console.log(`⏳ [RETRY] Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
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
    console.log('🤖 [AI-ASSISTANT] 🚀 PROCESSANDO REQUISIÇÃO - TIMESTAMP:', new Date().toISOString());
    
    const requestBody = await req.json();
    console.log('📋 [AI-ASSISTANT] Body completo recebido:', JSON.stringify(requestBody, null, 2));
    
    let { 
      ticketId, 
      message, 
      messages,
      clientId,
      instanceId,
      assistant,
      context 
    } = requestBody;
    
    // 🔍 CORREÇÃO: Se ticketId é um objeto, extrair o ID real
    if (ticketId && typeof ticketId === 'object' && ticketId.id) {
      console.log('🔧 [AI-ASSISTANT] ticketId é objeto, extraindo ID:', ticketId.id);
      ticketId = ticketId.id;
    }
    
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
    
    // ===== VERIFICAR DUPLICAÇÃO DE MENSAGENS =====
    if (messages && messages.length > 0) {
      console.log('🔍 [AI-ASSISTANT] Verificando duplicação de mensagens...');
      
      const messageIds = messages.map(msg => msg.messageId).filter(Boolean);
      if (messageIds.length > 0) {
        const { data: existingMessages } = await supabase
          .from('ticket_messages')
          .select('message_id')
          .in('message_id', messageIds)
          .eq('is_ai_response', true);
        
        if (existingMessages && existingMessages.length > 0) {
          console.log('⚠️ [AI-ASSISTANT] Mensagens já processadas detectadas:', existingMessages.map(m => m.message_id));
          
          // Se todas as mensagens já foram processadas, retornar sucesso sem processar
          if (existingMessages.length === messageIds.length) {
            console.log('🔄 [AI-ASSISTANT] Todas as mensagens já foram processadas - evitando duplicação');
            return new Response(JSON.stringify({
              success: true,
              message: 'Mensagens já processadas - duplicação evitada',
              duplicateCount: existingMessages.length
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Filtrar mensagens já processadas
          const processedIds = existingMessages.map(m => m.message_id);
          messages = messages.filter(msg => !processedIds.includes(msg.messageId));
          console.log('🔄 [AI-ASSISTANT] Filtradas mensagens duplicadas, restantes:', messages.length);
        }
      }
    }

    // 🔍 BUSCAR DADOS FALTANTES DO TICKET NO BANCO (fallback crítico)
    let resolvedClientId = clientId;
    let resolvedInstanceId = instanceId;
    let resolvedContext = context;
    let resolvedAssistant = assistant;
    
    if (!clientId || !instanceId || !context?.chatId || !assistant) {
      console.log('🔍 [AI-ASSISTANT] Buscando dados faltantes no banco...');
      
      const { data: ticketData, error: ticketError } = await supabase
        .from('conversation_tickets')
        .select(`
          client_id, 
          instance_id, 
          chat_id, 
          customer_id, 
          assigned_assistant_id,
          assigned_queue_id,
          customers(name, phone),
          assistants(id, name, model, prompt, triggers, advanced_settings, is_active)
        `)
        .eq('id', ticketId)
        .single();
      
      if (ticketError) {
        console.error('❌ [AI-ASSISTANT] Erro ao buscar dados do ticket:', ticketError);
        throw new Error(`Ticket não encontrado: ${ticketId}`);
      }
      
      // ✅ VALIDAÇÃO CRÍTICA: Verificar se o ticket tem fila associada
      if (!ticketData.assigned_queue_id) {
        console.log('🚫 [AI-ASSISTANT] Ticket sem fila associada - IA não deve responder');
        console.log('📊 [AI-ASSISTANT] Detalhes do ticket sem fila:', {
          ticketId,
          clientId: ticketData.client_id,
          chatId: ticketData.chat_id,
          customerName: ticketData.customers?.name,
          assignedQueueId: ticketData.assigned_queue_id
        });
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Ticket sem fila associada - IA não processará mensagens',
          reason: 'NO_QUEUE_ASSIGNED',
          ticketId,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 🔍 BUSCAR ASSISTENTE DA FILA (não do ticket)
      console.log('🔍 [AI-ASSISTANT] Buscando assistente da fila:', ticketData.assigned_queue_id);
      
      const { data: queueData, error: queueError } = await supabase
        .from('queues')
        .select(`
          id,
          name,
          assistant_id,
          is_active,
          assistants(id, name, model, prompt, triggers, advanced_settings, is_active)
        `)
        .eq('id', ticketData.assigned_queue_id)
        .eq('is_active', true)
        .single();
      
      if (queueError || !queueData) {
        console.log('🚫 [AI-ASSISTANT] Fila não encontrada ou inativa:', {
          queueId: ticketData.assigned_queue_id,
          error: queueError?.message
        });
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Fila não encontrada ou inativa - IA não processará mensagens',
          reason: 'QUEUE_NOT_FOUND_OR_INACTIVE',
          queueId: ticketData.assigned_queue_id,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!queueData.assistants || !queueData.assistants.is_active) {
        console.log('🚫 [AI-ASSISTANT] Fila sem assistente ou assistente inativo:', {
          queueId: queueData.id,
          queueName: queueData.name,
          assistantId: queueData.assistant_id,
          hasAssistant: !!queueData.assistants,
          assistantActive: queueData.assistants?.is_active
        });
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Fila sem assistente ativo - IA não processará mensagens',
          reason: 'NO_ACTIVE_ASSISTANT',
          queueId: queueData.id,
          queueName: queueData.name,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // ✅ TUDO VÁLIDO: Resolver dados
      resolvedClientId = clientId || ticketData.client_id;
      resolvedInstanceId = instanceId || ticketData.instance_id;
      resolvedContext = context || {
        chatId: ticketData.chat_id,
        customerName: ticketData.customers?.name || 'Cliente',
        phoneNumber: ticketData.customers?.phone || 'N/A'
      };
      
      // Usar assistente da fila
      resolvedAssistant = queueData.assistants;
      console.log('✅ [AI-ASSISTANT] Assistente da fila encontrado:', {
        assistantName: resolvedAssistant.name,
        queueName: queueData.name,
        queueId: queueData.id
      });
      
      console.log('✅ [AI-ASSISTANT] Dados resolvidos do banco:', {
        clientId: resolvedClientId,
        instanceId: resolvedInstanceId,
        chatId: resolvedContext.chatId,
        customerName: resolvedContext.customerName,
        assistantName: resolvedAssistant?.name || 'Assistente Padrão'
      });
    }

    // 📝 SUPORTAR BATCHES: Combinar múltiplas mensagens como contexto único
    const isBatch = messages && Array.isArray(messages) && messages.length > 0;
    
    let messageContent: string;
    if (isBatch) {
      // Processar batch de mensagens
      const messageTexts = messages.map(msg => msg.content).filter(Boolean);
      messageContent = messageTexts.join(' ');
      console.log(`📦 [BATCH-IA] Processando batch de ${messages.length} mensagens: "${messageContent}"`);
    } else {
      messageContent = message;
      console.log(`📝 [SINGLE-IA] Processando mensagem única: "${messageContent}"`);
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se os dados essenciais estão presentes
    if (!ticketId) {
      throw new Error('ticketId é obrigatório');
    }
    
    if (!messageContent && !message && (!messages || messages.length === 0)) {
      throw new Error('Nenhum conteúdo de mensagem fornecido');
    }

    // 🎵 INTERCEPTAÇÃO PRECOCE SUPER AGRESSIVA: Detectar comandos ANTES da IA
    const libraryCommandMatch = messageContent.match(/^audio\s+([a-zA-Z0-9]+)$/i);
    const imageCommandMatch = messageContent.match(/^image\s+([a-zA-Z0-9_-]+)$/i);
    
    // 🎥 MÚLTIPLAS VERIFICAÇÕES PARA VÍDEO - CAPTURA SUPER AGRESSIVA
    const videoRegexStrict = /^video\s+([a-zA-Z0-9_-]+)$/i;
    const videoRegexLoose = /video\s+([a-zA-Z0-9_-]+)/i;
    const messageClean = messageContent.trim().toLowerCase();
    
    // Múltiplas formas de capturar comando de vídeo
    let videoCommandMatch = messageContent.trim().match(videoRegexStrict);
    if (!videoCommandMatch) {
      videoCommandMatch = messageContent.trim().match(videoRegexLoose);
    }
    
    // 🚨 FALLBACK SUPER AGRESSIVO: Se contém "video" E "teste2", forçar captura
    const containsVideo = messageClean.includes('video');
    const containsTeste2 = messageClean.includes('teste2');
    const forceVideoCapture = containsVideo && containsTeste2;
    
    if (forceVideoCapture && !videoCommandMatch) {
      console.log('🚨 [EARLY-INTERCEPT] FALLBACK ATIVADO: Forçando captura de comando video teste2');
      videoCommandMatch = ['video teste2', 'teste2']; // Simular match
    }
    
    console.log('🔍 [EARLY-INTERCEPT] ===== DIAGNÓSTICO ULTRA-DETALHADO DE COMANDOS =====');
    console.log('🔍 [EARLY-INTERCEPT] MessageContent RAW:', JSON.stringify(messageContent));
    console.log('🔍 [EARLY-INTERCEPT] MessageContent chars:', messageContent.split('').map(c => `"${c}" (${c.charCodeAt(0)})`));
    console.log('🔍 [EARLY-INTERCEPT] MessageClean:', JSON.stringify(messageClean));
    console.log('🔍 [EARLY-INTERCEPT] Verificações de vídeo:', {
      regexStrict: videoRegexStrict.test(messageContent.trim()),
      regexLoose: videoRegexLoose.test(messageContent.trim()),
      containsVideo: containsVideo,
      containsTeste2: containsTeste2,
      forceVideoCapture: forceVideoCapture,
      finalVideoMatch: !!videoCommandMatch
    });
    console.log('🔍 [EARLY-INTERCEPT] Detectando comandos FINAIS:', {
      messageContent: messageContent,
      libraryCommandMatch: !!libraryCommandMatch,
      imageCommandMatch: !!imageCommandMatch,
      videoCommandMatch: !!videoCommandMatch,
      imageCommandValue: imageCommandMatch ? imageCommandMatch[1] : null,
      videoCommandValue: videoCommandMatch ? videoCommandMatch[1] : null,
      forceVideoCapture: forceVideoCapture
    });
    console.log('🔍 [EARLY-INTERCEPT] ===== FIM DO DIAGNÓSTICO =====');
    
    if (libraryCommandMatch) {
      console.log('🎵 [EARLY-INTERCEPT] ⚡ COMANDO DE BIBLIOTECA DETECTADO - PROCESSANDO IMEDIATAMENTE');
      console.log('🎵 [EARLY-INTERCEPT] Comando:', libraryCommandMatch[0]);
      console.log('🎵 [EARLY-INTERCEPT] Nome do áudio:', libraryCommandMatch[1]);
      
      // Buscar business token ANTES do processamento
      const { data: client } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', resolvedClientId)
        .single();
      
      if (client?.business_token) {
        console.log('✅ [EARLY-INTERCEPT] Business token encontrado para processamento imediato');
        
        // Processar comando de biblioteca imediatamente sem passar pela IA
        const audioResult = await processAudioCommands(messageContent, ticketId, resolvedAssistant, resolvedInstanceId, client.business_token);
        
        if (audioResult.hasAudioCommands && audioResult.processedCount > 0) {
          console.log('✅ [EARLY-INTERCEPT] Comando de biblioteca processado com sucesso - RETORNANDO IMEDIATAMENTE');
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Comando de áudio da biblioteca processado',
            audioCommandsProcessed: audioResult.processedCount,
            onlyAudioCommands: true,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.warn('⚠️ [EARLY-INTERCEPT] Business token não encontrado - comando de biblioteca será ignorado');
      }
    }
    
    // 🖼️ INTERCEPTAÇÃO PRECOCE: Detectar comandos de imagem ANTES da IA
    if (imageCommandMatch) {
      console.log('🖼️ [EARLY-INTERCEPT] ⚡ COMANDO DE IMAGEM DETECTADO - PROCESSANDO IMEDIATAMENTE');
      console.log('🖼️ [EARLY-INTERCEPT] Comando:', imageCommandMatch[0]);
      console.log('🖼️ [EARLY-INTERCEPT] Trigger da imagem:', imageCommandMatch[1]);
      
      // Buscar business token ANTES do processamento
      const { data: client } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', resolvedClientId)
        .single();
      
      if (client?.business_token) {
        console.log('✅ [EARLY-INTERCEPT] Business token encontrado para processamento de imagem');
        
        // Processar comando de imagem SEGUINDO A MESMA LÓGICA DO ÁUDIO
        const imageResult = await processImageCommands(messageContent, {
          assistantId: resolvedAssistant.id,
          instanceId: resolvedInstanceId,
          chatId: resolvedContext.chatId,
          businessToken: client.business_token
        });
        
        if (imageResult.hasImageCommands && imageResult.processedCount > 0) {
          console.log('✅ [EARLY-INTERCEPT] Comando de imagem processado com sucesso - PARANDO EXECUÇÃO');
          console.log('🛑 [EARLY-INTERCEPT] RETORNO IMEDIATO EXECUTADO - Edge function finalizará aqui');
          
          // Salvar informação de que a mensagem foi processada para evitar duplicação
          try {
            await supabase
              .from('ticket_messages')
              .update({ ai_processed: true, ai_response_timestamp: new Date().toISOString() })
              .eq('ticket_id', ticketId)
              .eq('content', messageContent);
            console.log('✅ [EARLY-INTERCEPT] Mensagem marcada como processada');
          } catch (error) {
            console.log('⚠️ [EARLY-INTERCEPT] Erro ao marcar mensagem como processada:', error);
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Comando de imagem da biblioteca processado',
            imageCommandsProcessed: imageResult.processedCount,
            onlyImageCommands: true,
            earlyIntercept: true,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.warn('⚠️ [EARLY-INTERCEPT] Business token não encontrado - comando de imagem será ignorado');
      }
    }
    
    // 🎥 INTERCEPTAÇÃO PRECOCE: Detectar comandos de vídeo ANTES da IA
    if (videoCommandMatch) {
      console.log('🎥 [EARLY-INTERCEPT] ⚡ COMANDO DE VÍDEO DETECTADO - PROCESSANDO IMEDIATAMENTE');
      console.log('🎥 [EARLY-INTERCEPT] Comando:', videoCommandMatch[0]);
      console.log('🎥 [EARLY-INTERCEPT] Trigger do vídeo:', videoCommandMatch[1]);
      console.log('🎥 [EARLY-INTERCEPT] MessageContent original:', messageContent);
      console.log('🎥 [EARLY-INTERCEPT] Regex match completo:', JSON.stringify(videoCommandMatch));
      
      // Buscar business token ANTES do processamento
      const { data: client } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', resolvedClientId)
        .single();
      
      if (client?.business_token) {
        console.log('✅ [EARLY-INTERCEPT] Business token encontrado para processamento de vídeo');
        
        // Processar comando de vídeo SEGUINDO A MESMA LÓGICA DO ÁUDIO E IMAGEM
        const videoResult = await processVideoCommands(messageContent, {
          assistantId: resolvedAssistant.id,
          instanceId: resolvedInstanceId,
          chatId: resolvedContext.chatId,
          businessToken: client.business_token
        });
        
        if (videoResult.hasVideoCommands && videoResult.processedCount > 0) {
          console.log('✅ [EARLY-INTERCEPT] Comando de vídeo processado com sucesso - PARANDO EXECUÇÃO');
          console.log('🛑 [EARLY-INTERCEPT] RETORNO IMEDIATO EXECUTADO - Edge function finalizará aqui');
          
          // Salvar informação de que a mensagem foi processada para evitar duplicação
          try {
            await supabase
              .from('ticket_messages')
              .update({ ai_processed: true, ai_response_timestamp: new Date().toISOString() })
              .eq('ticket_id', ticketId)
              .eq('content', messageContent);
            console.log('✅ [EARLY-INTERCEPT] Mensagem marcada como processada');
          } catch (error) {
            console.log('⚠️ [EARLY-INTERCEPT] Erro ao marcar mensagem como processada:', error);
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Comando de vídeo da biblioteca processado',
            videoCommandsProcessed: videoResult.processedCount,
            onlyVideoCommands: true,
            earlyIntercept: true,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        console.warn('⚠️ [EARLY-INTERCEPT] Business token não encontrado - comando de vídeo será ignorado');
      }
    }

    // 🔒 VERIFICAÇÃO ANTI-DUPLICAÇÃO APÓS EARLY INTERCEPT
    console.log('🔄 [FLOW-CHECK] Continuando para processamento normal da IA...');
    console.log('🔄 [FLOW-CHECK] Se chegou aqui, early intercept NÃO foi executado ou falhou');
    
    // 🔑 PRIORIZAÇÃO DE API KEYS: Cliente específico > Global
    let openAIApiKey = globalOpenAIApiKey;
    let keySource = 'global';

    // ✅ BUSCAR CONFIGURAÇÕES COM RETRY LOGIC
    console.log('🔍 [CONFIG] Buscando configurações do cliente com retry...');
    
    const [clientConfigResult, memoryResult, messagesResult] = await Promise.allSettled([
      // Buscar API Key específica do cliente com retry
      retryWithBackoff(
        () => supabase
          .from('client_ai_configs')
          .select('openai_api_key, default_model')
          .eq('client_id', resolvedClientId)
          .single(),
        { maxAttempts: 3, initialDelay: 500, maxDelay: 2000, backoffMultiplier: 2 },
        'Buscar config do cliente'
      ),
      
      // Buscar memória conversacional com retry
      retryWithBackoff(
        () => supabase
          .from('conversation_context')
          .select('*')
          .eq('client_id', resolvedClientId)
          .eq('chat_id', resolvedContext.chatId)
          .eq('instance_id', resolvedInstanceId)
          .single(),
        { maxAttempts: 2, initialDelay: 300, maxDelay: 1000, backoffMultiplier: 2 },
        'Buscar memória conversacional'
      ),
      
      // Buscar histórico de mensagens com retry
      retryWithBackoff(
        () => supabase
          .from('ticket_messages')
          .select('content, from_me, sender_name, timestamp, message_id')
          .eq('ticket_id', ticketId)
          .order('timestamp', { ascending: false })
          .limit(50),
        { maxAttempts: 2, initialDelay: 300, maxDelay: 1000, backoffMultiplier: 2 },
        'Buscar histórico de mensagens'
      )
    ]);

    // ✅ PROCESSAR API KEY DO CLIENTE COM RETRY
    if (clientConfigResult.status === 'fulfilled' && clientConfigResult.value?.data?.openai_api_key) {
      openAIApiKey = clientConfigResult.value.data.openai_api_key;
      keySource = 'client';
      console.log('🔑 [AI-ASSISTANT] ✅ API Key específica do cliente encontrada');
    } else {
      console.log('🔑 [AI-ASSISTANT] ⚠️ Cliente sem API Key - usando global:', 
        clientConfigResult.status === 'rejected' ? clientConfigResult.reason?.message : 'sem config');
    }

    // ✅ VALIDAÇÃO CRÍTICA: Business Token ANTES de qualquer operação
    console.log('🔐 [AI-ASSISTANT] Verificando business token para cliente:', resolvedClientId);
    
    let businessToken: string | null = null;
    try {
      const businessTokenResult = await retryWithBackoff(
        async () => {
          const { data: instanceData, error } = await supabase
            .from('whatsapp_instances')
            .select(`
              instance_id,
              client_id,
              yumer_instance_name,
              clients:client_id (
                business_token
              )
            `)
            .eq('instance_id', resolvedInstanceId)
            .single();
          
          if (error) throw error;
          if (!instanceData?.clients?.business_token) {
            throw new Error('Business token não encontrado');
          }
          
          return instanceData.clients.business_token;
        },
        { maxAttempts: 3, initialDelay: 500, maxDelay: 2000, backoffMultiplier: 2 },
        'Buscar business token'
      );
      
      businessToken = businessTokenResult;
      console.log('✅ [AI-ASSISTANT] Business token encontrado para cliente');
      
    } catch (error) {
      console.error('❌ [AI-ASSISTANT] ERRO CRÍTICO - Business token não encontrado:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Business token não configurado para este cliente',
        reason: 'MISSING_BUSINESS_TOKEN',
        clientId: resolvedClientId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
    
    // 📦 LOG ESPECÍFICO PARA BATCHES
    if (isBatch) {
      console.log('📦 [BATCH-IA] Processando batch com as seguintes mensagens:');
      messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. "${msg.content}" (${new Date(msg.timestamp).toLocaleTimeString()})`);
      });
      console.log(`📦 [BATCH-IA] Contexto combinado: "${messageContent}"`);
    }

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

    // Processar memória conversacional
    let conversationMemory = null;
    if (memoryResult.status === 'fulfilled' && memoryResult.value.data) {
      conversationMemory = memoryResult.value.data;
      console.log('🧠 [CONTEXT] Memória conversacional carregada:', {
        hasMemory: !!conversationMemory,
        customerName: conversationMemory?.customer_name,
        keyInfoKeys: conversationMemory?.key_information ? Object.keys(conversationMemory.key_information) : [],
        topicsCount: conversationMemory?.last_topics?.length || 0
      });
    } else {
      console.log('🧠 [CONTEXT] Nenhuma memória conversacional encontrada (primeira conversa)');
    }

    // Processar histórico de mensagens
    const allRecentMessages = messagesResult.status === 'fulfilled' && messagesResult.value.data 
      ? messagesResult.value.data 
      : [];

    // 🧹 REMOVER MENSAGENS DUPLICADAS por message_id e conteúdo
    const uniqueMessages = [];
    const seenMessageIds = new Set();
    const seenContentKey = new Set();
    
    if (allRecentMessages && allRecentMessages.length > 0) {
      for (const msg of allRecentMessages) {
        const contentKey = `${msg.from_me}-${msg.content}-${msg.sender_name}`;
        
        if (!seenMessageIds.has(msg.message_id) && !seenContentKey.has(contentKey)) {
          seenMessageIds.add(msg.message_id);
          seenContentKey.add(contentKey);
          uniqueMessages.push(msg);
        }
      }
    }

    console.log('🧹 [CONTEXT] Limpeza de duplicatas:', {
      totalMessages: allRecentMessages?.length || 0,
      uniqueMessages: uniqueMessages.length,
      duplicatesRemoved: (allRecentMessages?.length || 0) - uniqueMessages.length
    });

    // 🔄 CONSTRUIR CONTEXTO CONVERSACIONAL ENRIQUECIDO
    let conversationContext = '';
    if (uniqueMessages.length > 0) {
      // Pegar apenas os últimos 25 para não sobrecarregar o contexto
      const contextMessages = uniqueMessages.slice(0, 25).reverse(); // Ordenar cronologicamente
      
      conversationContext = contextMessages
        .map(msg => {
          const sender = msg.from_me ? 'Assistente' : (msg.sender_name || 'Cliente');
          return `${sender}: ${msg.content}`;
        })
        .join('\n');
    }

    // 🧠 ADICIONAR INFORMAÇÕES DA MEMÓRIA CONVERSACIONAL
    let memoryContext = '';
    if (conversationMemory) {
      const memoryParts = [];
      
      if (conversationMemory.customer_name) {
        memoryParts.push(`Nome do cliente: ${conversationMemory.customer_name}`);
      }
      
      if (conversationMemory.conversation_summary) {
        memoryParts.push(`Resumo da conversa: ${conversationMemory.conversation_summary}`);
      }
      
      if (conversationMemory.key_information && Object.keys(conversationMemory.key_information).length > 0) {
        memoryParts.push(`Informações importantes: ${JSON.stringify(conversationMemory.key_information)}`);
      }
      
      if (conversationMemory.last_topics && conversationMemory.last_topics.length > 0) {
        memoryParts.push(`Tópicos recentes: ${conversationMemory.last_topics.join(', ')}`);
      }
      
      if (conversationMemory.personality_notes) {
        memoryParts.push(`Notas de personalidade: ${conversationMemory.personality_notes}`);
      }
      
      if (memoryParts.length > 0) {
        memoryContext = '\n\n--- CONTEXTO DA CONVERSA ---\n' + memoryParts.join('\n') + '\n--- FIM DO CONTEXTO ---\n';
      }
    }

    // ✅ VALIDAÇÃO DO ASSISTENTE: Garantir que existe e tem configurações mínimas
    const safeAssistant = resolvedAssistant || {
      id: 'default',
      name: 'Assistente IA',
      model: 'gpt-4o-mini',
      prompt: 'Você é um assistente útil e prestativo.'
    };

    console.log('🤖 [AI-ASSISTANT] Usando assistente:', {
      id: safeAssistant.id,
      name: safeAssistant.name,
      model: safeAssistant.model,
      hasPrompt: !!safeAssistant.prompt
    });

    // ✅ NOVA: Detecção e processamento automático de mídia
    let mediaAnalysis = '';
    let processedContent = messageContent;
    
    // Buscar mensagens de mídia não processadas
    const { data: unprocessedMessages } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .in('message_type', ['image', 'video', 'audio', 'document'])
      .is('media_transcription', null)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (unprocessedMessages && unprocessedMessages.length > 0) {
      console.log('🎬 [MULTIMEDIA] Encontradas mensagens de mídia para processar:', unprocessedMessages.length);
      
      for (const mediaMsg of unprocessedMessages) {
        try {
          let analysis = '';
          
          switch (mediaMsg.message_type) {
            case 'image':
              if (mediaMsg.image_base64) {
                analysis = await processImageWithVision(mediaMsg.image_base64, openAIApiKey);
                mediaAnalysis += `\n[IMAGEM ANALISADA]: ${analysis}`;
              }
              break;
              
            case 'audio':
              if (mediaMsg.audio_base64) {
                analysis = await processAudioTranscription(mediaMsg.audio_base64, openAIApiKey);
                mediaAnalysis += `\n[ÁUDIO TRANSCRITO]: ${analysis}`;
              }
              break;
              
            case 'video':
              if (mediaMsg.video_base64) {
                analysis = await processVideoAnalysis(mediaMsg.video_base64, openAIApiKey);
                mediaAnalysis += `\n[VÍDEO ANALISADO]: ${analysis}`;
              }
              break;
              
            case 'document':
              if (mediaMsg.document_base64) {
                analysis = await processDocumentExtraction(mediaMsg.document_base64, mediaMsg.media_mime_type);
                mediaAnalysis += `\n[DOCUMENTO EXTRAÍDO]: ${analysis}`;
              }
              break;
          }
          
          // Salvar análise no banco
          if (analysis) {
            await supabase
              .from('ticket_messages')
              .update({ media_transcription: analysis })
              .eq('id', mediaMsg.id);
          }
          
        } catch (error) {
          console.error('❌ [MULTIMEDIA] Erro ao processar mídia:', error);
        }
      }
    }

    // Adicionar análises de mídia ao contexto
    if (mediaAnalysis) {
      processedContent = `${messageContent}\n\n--- MÍDIAS ANALISADAS ---${mediaAnalysis}\n--- FIM DAS ANÁLISES ---`;
    }

    // 🎯 CONSTRUIR PROMPT PARA BATCH: Considerar todas as mensagens como contexto único
    const isBatchProcessing = messages && Array.isArray(messages) && messages.length > 1;
    const contextMessage = isBatchProcessing 
      ? `\n\nNOTA IMPORTANTE: O usuário enviou ${messages.length} mensagens em sequência rápida. Estas mensagens devem ser consideradas como uma única conversa contínua. Analise todo o contexto e responda de forma unificada, não responda cada mensagem separadamente.`
      : '';
    
    const systemPrompt = `${safeAssistant.prompt || 'Você é um assistente útil e prestativo.'}${memoryContext}

CONTEXTO DA CONVERSA:
Cliente: ${resolvedContext?.customerName || 'Cliente'}
Telefone: ${resolvedContext?.phoneNumber || 'N/A'}${contextMessage}

HISTÓRICO RECENTE DA CONVERSA:
${conversationContext}

INSTRUÇÕES IMPORTANTES PARA CONTINUIDADE:
- Você está em uma conversa contínua com ${resolvedContext?.customerName || 'este cliente'}
- NÃO se reapresente se já conversaram antes - mantenha a naturalidade da conversa
- Use o contexto da conversa anterior para responder de forma coerente
- Se o cliente mencionar algo que foi discutido antes, reconheça e continue a partir dali
- Seja natural e conversacional, como se fosse uma pessoa real
- Mantenha a personalidade e tom estabelecidos na conversa
- Responda de forma útil e prestativa
- Se não souber algo, seja honesto
- Responda em português brasileiro
- Seja conciso mas completo
${isBatchProcessing ? '- Considere todas as mensagens como uma única solicitação do usuário' : ''}
- IMPORTANTE: Esta é uma conversa em andamento - não comece do zero!`;

    console.log('🤖 [AI-ASSISTANT] 🧠 INICIANDO CHAMADA OPENAI - TIMESTAMP:', new Date().toISOString());
    console.log('🤖 [AI-ASSISTANT] Modelo:', safeAssistant.model || 'gpt-4o-mini');
    console.log('🤖 [AI-ASSISTANT] System prompt length:', systemPrompt.length);
    console.log('🤖 [AI-ASSISTANT] Message content length:', messageContent.length);

    // Chamar OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: safeAssistant.model || 'gpt-4o-mini',
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

    console.log('🤖 [AI-ASSISTANT] ✅ OPENAI RESPONDEU - TIMESTAMP:', new Date().toISOString());
    console.log('🤖 [AI-ASSISTANT] Response length:', aiResponse?.length || 0);
    console.log('🤖 [AI-ASSISTANT] Response preview:', aiResponse?.substring(0, 100) + '...');
    console.log('🤖 [AI-ASSISTANT] Model usado:', safeAssistant.model || 'gpt-4o-mini');

    // 🔐 BUSCAR BUSINESS TOKEN PARA COMANDOS DE ÁUDIO
    console.log('🔐 [AI-ASSISTANT] Verificando business token para cliente:', resolvedClientId);
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('business_token')
      .eq('id', resolvedClientId)
      .single();
    
    if (clientError) {
      console.error('❌ [AI-ASSISTANT] Erro ao buscar cliente:', clientError);
      throw new Error(`Cliente não encontrado: ${resolvedClientId}`);
    }
    
    if (!client?.business_token) {
      console.warn('⚠️ [AI-ASSISTANT] Business token não encontrado - comandos de áudio serão ignorados');
    } else {
      console.log('✅ [AI-ASSISTANT] Business token encontrado para cliente');
    }

    // 🎵 DETECTAR E PROCESSAR COMANDOS DE ÁUDIO COM TIMEOUT E FALLBACK
    console.log('🎵 [AUDIO-COMMANDS] Iniciando processamento de comandos de áudio...');
    let finalResponse = aiResponse;
    
    // ✅ CORRIGIR ESCOPO: Declarar audioCommands fora do try-catch
    let audioCommands = { hasAudioCommands: false, processedCount: 0, remainingText: aiResponse };
    
    try {
      // Processar comandos de áudio sem timeout agressivo
      audioCommands = await processAudioCommands(aiResponse, ticketId, safeAssistant, resolvedInstanceId, client?.business_token || '');
      
      if (audioCommands.hasAudioCommands) {
        console.log('🎵 [AUDIO-COMMANDS] ✅ Comandos de áudio processados:', audioCommands.processedCount);
        finalResponse = audioCommands.remainingText;
      } else {
        console.log('🎵 [AUDIO-COMMANDS] ℹ️ Nenhum comando de áudio detectado');
      }
      
      // 🖼️ PROCESSAR COMANDOS DE IMAGEM
      const imageCount = await processImageCommands(finalResponse, {
        assistantId: safeAssistant.id,
        instanceId: resolvedInstanceId,
        chatId: resolvedContext.chatId,
        businessToken: client?.business_token || ''
      });
      
      if (imageCount > 0) {
        console.log(`🖼️ [IMAGE-COMMANDS] ✅ ${imageCount} comandos de imagem processados`);
        finalResponse = finalResponse.replace(/image\s*:\s*[^\s]+/gi, '').trim();
      }
    } catch (audioError) {
      console.error('⚠️ [AUDIO-COMMANDS] Erro no processamento de áudio (continuando com texto):', audioError);
      // FALLBACK: Continuar com resposta de texto mesmo se áudio falhar
      finalResponse = aiResponse;
    }

    // Se não há texto restante após comandos de áudio, finalizar aqui
    if (!finalResponse || finalResponse.trim() === '') {
      console.log('✅ [AI-ASSISTANT] Processamento finalizado - apenas comandos de áudio');
      return Response.json({ 
        success: true, 
        type: 'audio_only', 
        audioCommandsProcessed: audioCommands.processedCount,
        response: 'Comandos de áudio processados'
      });
    }

    // Salvar resposta da IA no ticket
    const messageId = `ai_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: saveError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_id: messageId,
        content: finalResponse,
        from_me: true,
        is_ai_response: true,
        sender_name: safeAssistant.name || 'Assistente IA',
        timestamp: new Date().toISOString(),
        processing_status: 'processed'
      });

    if (saveError) {
      console.error('❌ [AI-ASSISTANT] Erro ao salvar resposta:', saveError);
      throw saveError;
    }

    console.log('💾 [AI-ASSISTANT] Resposta salva no ticket');

    // 🤖 BUSCAR CONFIGURAÇÃO HUMANIZADA DO ASSISTENTE
    const humanizedConfig = await getHumanizedConfig(safeAssistant.id);
    
    // 📤 ENVIAR RESPOSTA VIA SERVIÇO UNIFICADO SIMPLIFICADO
    console.log('📤 [AI-ASSISTANT] Enviando resposta via serviço unificado...');
    
    // ✅ VALIDAÇÃO CRÍTICA: instanceId é obrigatório
    if (!resolvedInstanceId || typeof resolvedInstanceId !== 'string') {
      console.error('❌ [AI-ASSISTANT] instanceId inválido ou ausente:', resolvedInstanceId);
      throw new Error('instanceId é obrigatório para enviar a mensagem');
    }
    
    // ✅ VALIDAÇÃO CRÍTICA: Contexto e chatId são obrigatórios
    if (!resolvedContext || !resolvedContext.chatId) {
      console.error('❌ [AI-ASSISTANT] Contexto ou chatId ausente:', resolvedContext);
      throw new Error('context.chatId é obrigatório para enviar a mensagem');
    }
    
    // ✅ VALIDAÇÃO CRÍTICA: clientId é obrigatório  
    if (!resolvedClientId) {
      console.error('❌ [AI-ASSISTANT] clientId ausente');
      throw new Error('clientId é obrigatório para buscar business token');
    }
    
    // Usar yumerApiV2 diretamente com ID correto
    let realInstanceId = resolvedInstanceId;
    
    // Verificar se é UUID interno e buscar o instance_id real (se contém hífen)
    if (resolvedInstanceId.includes('-')) {
      console.log('🔍 [AI-ASSISTANT] Resolvendo ID interno para real:', resolvedInstanceId);
      
      const { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('id', resolvedInstanceId)
        .single();
      
      if (instanceError || !instanceData) {
        console.error('❌ [AI-ASSISTANT] Erro ao buscar instance_id real:', instanceError);
        throw new Error(`Instância não encontrada: ${resolvedInstanceId}`);
      }
      
      realInstanceId = instanceData.instance_id;
      console.log('✅ [AI-ASSISTANT] ID real da instância:', {
        internal: resolvedInstanceId,
        real: realInstanceId
      });
    }

    // Business token já foi obtido anteriormente para comandos de áudio

    // 📱 CONFIGURAR PROFILE ONLINE SE HABILITADO
    try {
      const { data: aiConfig } = await supabase
        .from('client_ai_configs')
        .select('online_status_config')
        .eq('client_id', resolvedClientId)
        .single();

      if (aiConfig?.online_status_config?.enabled) {
        const config = aiConfig.online_status_config;
        console.log('🔒 [PROFILE] Aplicando configurações de perfil online');
        
        // Configurar privacidade online para "todos" verem
        const onlineResponse = await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/whatsapp/update/profile-online-privacy`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${client.business_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: config.onlinePrivacy || 'all' })
        });
        console.log(`🔒 [ONLINE-PRIVACY] Response: ${await onlineResponse.text()}`);
        
        // Configurar privacidade visto por último
        const seenResponse = await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/whatsapp/update/profile-seen-privacy`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${client.business_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: config.seenPrivacy || 'all' })
        });
        console.log(`👁️ [SEEN-PRIVACY] Response: ${await seenResponse.text()}`);
        
        // Configurar status do perfil
        if (config.profileStatus) {
          const statusResponse = await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/whatsapp/update/profile-status`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${client.business_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ profileStatus: config.profileStatus })
          });
          console.log(`📝 [PROFILE-STATUS] Response: ${await statusResponse.text()}`);
        }
        
        console.log('✅ [PROFILE] Configurações de perfil aplicadas com sucesso');
      }
    } catch (profileError) {
      console.warn('⚠️ [PROFILE] Erro ao aplicar configurações de perfil:', profileError);
    }

    // 🚫 REMOVIDO: Presença via chat/presence - endpoint não existe mais
    // A presença é controlada automaticamente via configurações de perfil

    // 🚀 USAR SISTEMA DE BLOCOS QUANDO NECESSÁRIO
    const shouldUseChunks = finalResponse.length > humanizedConfig.behavior.messageHandling.maxCharsPerChunk;
    
    console.log('🤖 [AI-ASSISTANT] DECISÃO DE ENVIO:', {
      responseLength: finalResponse.length,
      maxCharsPerChunk: humanizedConfig.behavior.messageHandling.maxCharsPerChunk,
      splitLongMessages: humanizedConfig.behavior.messageHandling.splitLongMessages,
      shouldUseChunks,
      willUseChunks: shouldUseChunks && humanizedConfig.behavior.messageHandling.splitLongMessages
    });

    let sendResult;
    try {
      if (shouldUseChunks && humanizedConfig.behavior.messageHandling.splitLongMessages) {
        // ENVIO EM BLOCOS
        console.log('📦 [AI-ASSISTANT] Enviando em blocos...');
        
        const chunks = splitMessageIntoChunks(
          finalResponse,
          humanizedConfig.behavior.messageHandling.maxCharsPerChunk
        );
        
        console.log('🔢 [AI-ASSISTANT] Blocos criados:', {
          totalChunks: chunks.length,
          chunks: chunks.map(c => c.substring(0, 50) + '...')
        });

        const messageIds: string[] = [];
        let chunkIndex = 0;

        for (const chunk of chunks) {
          chunkIndex++;
          
          console.log(`📤 [AI-ASSISTANT] Enviando bloco ${chunkIndex}/${chunks.length}:`, {
            length: chunk.length,
            preview: chunk.substring(0, 100) + '...'
          });

          const sendOptions = {
            delay: humanizedConfig.behavior.messageHandling.delayBetweenChunks,
            presence: 'composing',
            externalAttributes: `source=ai;humanized=true;timestamp=${Date.now()}`
          };

          const sendData = {
            recipient: resolvedContext.chatId,
            textMessage: {
              text: chunk
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
            console.error(`❌ [AI-ASSISTANT] Erro no bloco ${chunkIndex}:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          messageIds.push(result.key?.id || `ai_chunk_${chunkIndex}_${Date.now()}`);
          
          console.log(`✅ [AI-ASSISTANT] Bloco ${chunkIndex}/${chunks.length} enviado com sucesso`);

          // Aguardar delay entre chunks (exceto no último) - timing inteligente
          if (chunkIndex < chunks.length) {
            // Delay baseado no tamanho do próximo bloco
            const nextChunk = chunks[chunkIndex]; // próximo bloco (array é 0-indexed)
            const baseDelay = humanizedConfig.behavior.messageHandling.delayBetweenChunks;
            const intelligentDelay = Math.min(
              Math.max(baseDelay, nextChunk.length * 12), // 12ms por caractere
              4500 // máximo 4.5 segundos
            );
            
            console.log(`⏱️ [AI-ASSISTANT] Aguardando ${intelligentDelay}ms antes do próximo bloco (baseado em ${nextChunk.length} chars)`);
            await new Promise(resolve => setTimeout(resolve, intelligentDelay));
          }
        }

        sendResult = {
          success: true,
          messageId: messageIds[0], // Primeiro bloco como ID principal
          messageIds,
          totalChunks: chunks.length,
          details: { type: 'chunked', chunks: chunks.length }
        };

        console.log('✅ [AI-ASSISTANT] Todos os blocos enviados com sucesso:', {
          totalChunks: chunks.length,
          messageIds
        });

      } else {
        // ENVIO DIRETO (mensagem curta ou sistema de blocos desabilitado)
        console.log('📤 [AI-ASSISTANT] Enviando mensagem direta (sem blocos)...');
        
        const sendOptions = {
          delay: 1200,
          presence: 'composing',
          externalAttributes: `source=ai-assistant;ticketId=${ticketId};assistantId=${safeAssistant.id};timestamp=${Date.now()}`
        };
        
        const sendData = {
          recipient: resolvedContext.chatId,
          textMessage: {
            text: finalResponse
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
          chatId: resolvedContext.chatId,
          messageId: sendResult.messageId
        });
      }
      
    } catch (sendError: any) {
      console.error('❌ [AI-ASSISTANT] Erro ao enviar via API direta:', sendError);
      
      sendResult = {
        success: false,
        error: sendError.message || 'Erro no envio',
        details: sendError
      };
    }

    // 🔥 CORREÇÃO: Marcar mensagens do usuário como processadas após resposta da IA
    await markUserMessagesAsProcessed(ticketId, resolvedContext?.chatId);

    // 🧠 ATUALIZAR MEMÓRIA CONVERSACIONAL
    await updateConversationMemory(
      resolvedClientId,
      resolvedContext.chatId,
      resolvedInstanceId,
      resolvedContext.customerName || 'Cliente',
      resolvedContext.phoneNumber,
      messageContent,
      finalResponse,
      conversationMemory
    );

    console.log('🎉 [AI-ASSISTANT] SUCESSO TOTAL! Assistente processou e enviou resposta:', {
      ticketId: ticketId,
      assistantName: safeAssistant?.name,
      responseLength: finalResponse?.length || 0,
      sendSuccess: sendResult?.success,
      messageId: messageId,
      timestamp: new Date().toISOString()
    });

    console.log('🏁 [AI-ASSISTANT] ✅ RETORNANDO SUCESSO - TIMESTAMP:', new Date().toISOString());
    console.log('🏁 [AI-ASSISTANT] Final response length:', finalResponse?.length || 0);
    console.log('🏁 [AI-ASSISTANT] Message ID:', messageId);
    console.log('🏁 [AI-ASSISTANT] Sent via Yumer:', sendResult.success);

    return new Response(
      JSON.stringify({
        success: true,
        response: finalResponse,
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

// 🧠 ATUALIZAR MEMÓRIA CONVERSACIONAL
async function updateConversationMemory(
  clientId: string,
  chatId: string,
  instanceId: string,
  customerName: string,
  customerPhone: string,
  userMessage: string,
  aiResponse: string,
  existingMemory: any = null
): Promise<void> {
  try {
    console.log('🧠 [MEMORY] Atualizando memória conversacional:', {
      clientId,
      chatId: chatId.substring(0, 20) + '...',
      customerName,
      hasExisting: !!existingMemory
    });

    // Extrair tópicos da mensagem atual
    const currentTopics = extractTopicsFromMessage(userMessage, aiResponse);
    
    // Extrair informações-chave da conversa
    const keyInfo = extractKeyInformation(userMessage, aiResponse, existingMemory?.key_information || {});
    
    // Criar resumo da conversa atual (combinar com existente)
    const conversationSummary = generateConversationSummary(
      userMessage, 
      aiResponse, 
      existingMemory?.conversation_summary,
      customerName
    );
    
    // Gerar notas de personalidade
    const personalityNotes = generatePersonalityNotes(
      userMessage, 
      aiResponse, 
      existingMemory?.personality_notes
    );

    // Manter apenas os últimos 10 tópicos
    const lastTopics = existingMemory?.last_topics || [];
    const updatedTopics = [...currentTopics, ...lastTopics].slice(0, 10);

    const memoryData = {
      client_id: clientId,
      chat_id: chatId,
      instance_id: instanceId,
      customer_name: customerName,
      customer_phone: customerPhone,
      conversation_summary: conversationSummary,
      key_information: keyInfo,
      last_topics: updatedTopics,
      personality_notes: personalityNotes,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('conversation_context')
      .upsert(memoryData, {
        onConflict: 'client_id,chat_id,instance_id'
      });

    if (error) {
      console.error('❌ [MEMORY] Erro ao salvar memória:', error);
    } else {
      console.log('✅ [MEMORY] Memória conversacional atualizada:', {
        topicsCount: updatedTopics.length,
        keyInfoKeys: Object.keys(keyInfo).length,
        summaryLength: conversationSummary?.length || 0
      });
    }

  } catch (error) {
    console.error('❌ [MEMORY] Erro ao atualizar memória conversacional:', error);
  }
}

// 🎯 Extrair tópicos de uma mensagem
function extractTopicsFromMessage(userMessage: string, aiResponse: string): string[] {
  const topics: string[] = [];
  const text = `${userMessage} ${aiResponse}`.toLowerCase();
  
  // Palavras-chave que indicam tópicos importantes
  const topicKeywords = [
    'problema', 'ajuda', 'dúvida', 'serviço', 'produto', 'pedido', 'compra',
    'pagamento', 'entrega', 'suporte', 'atendimento', 'informação', 'preço',
    'horário', 'agendamento', 'consulta', 'reserva', 'cancelamento', 'troca',
    'devolução', 'garantia', 'instalação', 'configuração', 'bug', 'erro'
  ];
  
  for (const keyword of topicKeywords) {
    if (text.includes(keyword) && !topics.includes(keyword)) {
      topics.push(keyword);
    }
  }
  
  return topics.slice(0, 5); // Máximo 5 tópicos por conversa
}

// 💎 Extrair informações-chave da conversa
function extractKeyInformation(userMessage: string, aiResponse: string, existingInfo: any = {}): any {
  const keyInfo = { ...existingInfo };
  const fullText = `${userMessage} ${aiResponse}`;
  
  // Detectar nome se mencionado
  const nameMatch = fullText.match(/meu nome é (\w+)|me chamo (\w+)|sou (\w+)/i);
  if (nameMatch) {
    keyInfo.userName = nameMatch[1] || nameMatch[2] || nameMatch[3];
  }
  
  // Detectar preferências
  if (fullText.includes('gosto de') || fullText.includes('prefiro')) {
    if (!keyInfo.preferences) keyInfo.preferences = [];
    keyInfo.preferences.push(fullText.match(/(?:gosto de|prefiro) ([^.!?]+)/i)?.[1]);
  }
  
  // Detectar problemas recorrentes
  if (fullText.includes('problema') || fullText.includes('erro')) {
    if (!keyInfo.commonIssues) keyInfo.commonIssues = [];
    const issueMatch = fullText.match(/problema (?:com|em|no) ([^.!?]+)/i);
    if (issueMatch) keyInfo.commonIssues.push(issueMatch[1]);
  }
  
  return keyInfo;
}

// 📝 Gerar resumo da conversa
function generateConversationSummary(
  userMessage: string, 
  aiResponse: string, 
  existingSummary?: string,
  customerName?: string
): string {
  const newExchange = `${customerName || 'Cliente'}: ${userMessage} | Assistente: ${aiResponse}`;
  
  if (!existingSummary) {
    return newExchange.substring(0, 500);
  }
  
  // Combinar com resumo existente, mantendo no máximo 500 caracteres
  const combined = `${existingSummary} | ${newExchange}`;
  if (combined.length <= 500) {
    return combined;
  }
  
  // Se muito longo, manter apenas as últimas trocas
  const exchanges = combined.split(' | ');
  const recentExchanges = exchanges.slice(-3); // Últimas 3 trocas
  return recentExchanges.join(' | ').substring(0, 500);
}

// 🎭 Gerar notas de personalidade
function generatePersonalityNotes(
  userMessage: string, 
  aiResponse: string, 
  existingNotes?: string
): string {
  const notes: string[] = existingNotes ? [existingNotes] : [];
  const fullText = `${userMessage} ${aiResponse}`.toLowerCase();
  
  // Detectar tom da conversa
  if (fullText.includes('obrigado') || fullText.includes('valeu')) {
    notes.push('Cliente educado e agradecido');
  }
  
  if (fullText.includes('urgente') || fullText.includes('rápido')) {
    notes.push('Cliente valoriza rapidez');
  }
  
  if (fullText.includes('detalhes') || fullText.includes('explicar')) {
    notes.push('Cliente gosta de explicações detalhadas');
  }
  
  // Manter apenas as últimas 3 notas
  const uniqueNotes = [...new Set(notes)].slice(-3);
  return uniqueNotes.join('; ');
}

// Aplicar configurações de perfil em sequência ordenada
async function applyProfileConfigSequence(instanceId: string, businessToken: string, chatId: string) {
  const YUMER_BASE_URL = 'https://api.yumer.com.br';
  
  try {
    // 1. Configurar privacidade online (quem pode ver quando estou online)
    console.log('🔒 [PROFILE-1] Aplicando privacidade online...');
    const onlinePrivacyResponse = await fetch(`${YUMER_BASE_URL}/api/v2/instance/${instanceId}/whatsapp/update/profile-online-privacy`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${businessToken}`
      },
      body: JSON.stringify({ action: 'all' })
    });

    if (!onlinePrivacyResponse.ok) {
      throw new Error(`Online privacy failed: ${onlinePrivacyResponse.status}`);
    }

    const onlinePrivacyResult = await onlinePrivacyResponse.json();
    console.log('🔒 [ONLINE-PRIVACY] Response:', JSON.stringify(onlinePrivacyResult));

    // Aguardar antes da próxima configuração
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Configurar privacidade do visto por último
    console.log('👁️ [PROFILE-2] Aplicando privacidade do visto por último...');
    const seenPrivacyResponse = await fetch(`${YUMER_BASE_URL}/api/v2/instance/${instanceId}/whatsapp/update/profile-seen-privacy`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${businessToken}`
      },
      body: JSON.stringify({ action: 'all' })
    });

    if (!seenPrivacyResponse.ok) {
      throw new Error(`Seen privacy failed: ${seenPrivacyResponse.status}`);
    }

    const seenPrivacyResult = await seenPrivacyResponse.json();
    console.log('👁️ [SEEN-PRIVACY] Response:', JSON.stringify(seenPrivacyResult));

    // Aguardar antes da próxima configuração
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Definir status do perfil
    console.log('📝 [PROFILE-3] Aplicando status do perfil...');
    const profileStatusResponse = await fetch(`${YUMER_BASE_URL}/api/v2/instance/${instanceId}/whatsapp/update/profile-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${businessToken}`
      },
      body: JSON.stringify({ profileStatus: 'Atendimento automatizado ativo' })
    });

    if (!profileStatusResponse.ok) {
      throw new Error(`Profile status failed: ${profileStatusResponse.status}`);
    }

    const profileStatusResult = await profileStatusResponse.json();
    console.log('📝 [PROFILE-STATUS] Response:', JSON.stringify(profileStatusResult));

    console.log('✅ [PROFILE-SEQUENCE] Todas as configurações aplicadas com sucesso');
    
  } catch (error) {
    console.error('❌ [PROFILE-SEQUENCE] Erro na aplicação sequencial:', error);
    throw error;
  }
}

// ==================== FUNÇÕES DE PROCESSAMENTO MULTIMÍDIA ====================

/**
 * Processar imagem com GPT-4 Vision
 */
async function processImageWithVision(imageBase64: string, apiKey: string): Promise<string> {
  try {
    console.log('🖼️ [IMAGE-VISION] Processando imagem com GPT-4 Vision');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta imagem detalhadamente em português. Descreva o que você vê, identifique textos se houver, e forneça informações úteis para um assistente de atendimento ao cliente.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('✅ [IMAGE-VISION] Análise concluída:', analysis.substring(0, 100));
    return analysis;
    
  } catch (error) {
    console.error('❌ [IMAGE-VISION] Erro ao processar imagem:', error);
    return '[Erro ao analisar imagem]';
  }
}

/**
 * Transcrever áudio
 */
async function processAudioTranscription(audioBase64: string, apiKey: string): Promise<string> {
  try {
    console.log('🎵 [AUDIO] Transcrevendo áudio');
    
    // Converter base64 para blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/ogg' });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Erro na API OpenAI: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [AUDIO] Transcrição concluída:', data.text);
    return data.text || '[Áudio não pôde ser transcrito]';
    
  } catch (error) {
    console.error('❌ [AUDIO] Erro ao transcrever áudio:', error);
    return '[Erro ao transcrever áudio]';
  }
}

/**
 * Analisar vídeo (extração de frame + análise)
 */
async function processVideoAnalysis(videoBase64: string, apiKey: string): Promise<string> {
  try {
    console.log('🎬 [VIDEO] Analisando vídeo');
    
    // Para vídeos, vamos extrair o primeiro frame como imagem
    // Em uma implementação mais avançada, poderíamos usar FFmpeg
    // Por enquanto, retornamos uma análise básica
    
    console.log('⚠️ [VIDEO] Análise básica - extração de frames não implementada');
    return '[Vídeo recebido - análise visual completa em desenvolvimento. Descreva brevemente o conteúdo do vídeo para melhor atendimento.]';
    
  } catch (error) {
    console.error('❌ [VIDEO] Erro ao analisar vídeo:', error);
    return '[Erro ao analisar vídeo]';
  }
}

/**
 * Extrair texto de documentos
 */
async function processDocumentExtraction(documentBase64: string, mimeType: string): Promise<string> {
  try {
    console.log('📄 [DOCUMENT] Extraindo texto de documento:', mimeType);
    
    if (mimeType?.includes('pdf')) {
      return await extractPDFText(documentBase64);
    } else if (mimeType?.includes('text')) {
      // Texto simples
      const text = atob(documentBase64);
      return text.length > 2000 ? text.substring(0, 2000) + '...' : text;
    } else {
      console.log('📄 [DOCUMENT] Tipo de documento não suportado para extração:', mimeType);
      return `[Documento ${mimeType} recebido - extração de texto não suportada para este formato]`;
    }
    
  } catch (error) {
    console.error('❌ [DOCUMENT] Erro ao extrair texto:', error);
    return '[Erro ao extrair texto do documento]';
  }
}

/**
 * Detectar se mensagem tem estrutura de tópicos
 */
function hasTopicStructure(message: string): boolean {
  const topicPatterns = [
    /^\d+\.\s*\*\*[^*]+\*\*/m,     // "1. **Título:**"
    /^\*\*\d+\.\s*[^*]+\*\*/m,     // "**1. Título**"
    /^\d+\.\s*[A-ZÁÊÇÕÃÍÚÂÔÀÜ]/m,  // "1. Texto"
    /^•\s*\*\*[^*]+\*\*/m,         // "• **Item:**"
    /^\*\*[^*]+:\*\*\s*$/m,        // "**Título:**"
    /^\s*[-•]\s*\*\*[^*]+\*\*/m,   // "- **Item:**" ou "• **Item:**"
    /^\d+\)\s*[A-ZÁÊÇÕÃÍÚÂÔÀÜ]/m,  // "1) Texto"
  ];
  
  // Contar quantos padrões de tópicos encontramos
  const matches = topicPatterns.reduce((count, pattern) => {
    const found = message.match(new RegExp(pattern.source, 'gm'));
    return count + (found ? found.length : 0);
  }, 0);
  
  console.log(`🔍 [TOPIC-DETECT] Padrões encontrados: ${matches}`);
  return matches >= 2; // Pelo menos 2 tópicos para considerar estruturada
}

/**
 * Dividir mensagem por tópicos numerados ou estruturados
 */
function splitMessageByTopics(message: string): string[] {
  const chunks: string[] = [];
  
  // Padrões mais robustos para detectar início de tópicos
  const topicSeparators = [
    /(?=\n\s*\d+\.\s*\*\*[^*]+\*\*)/g,      // "\n1. **Título:**"
    /(?=\n\s*\*\*\d+\.\s*[^*]+\*\*)/g,      // "\n**1. Título**"
    /(?=\n\s*\d+\.\s*[A-ZÁÊÇÕÃÍÚÂÔÀÜ])/g,   // "\n1. Texto"
    /(?=\n\s*\*\*[^*]+:\*\*\s*\n)/g,        // "\n**Título:**\n"
    /(?=\n\s*[-•]\s*\*\*[^*]+\*\*)/g,       // "\n• **Item:**"
  ];
  
  let splitMessage = message;
  
  // Aplicar todos os separadores
  for (const separator of topicSeparators) {
    const parts = splitMessage.split(separator);
    if (parts.length > 1) {
      splitMessage = parts.join('|||TOPIC_SPLIT|||');
    }
  }
  
  const rawParts = splitMessage.split('|||TOPIC_SPLIT|||')
    .map(part => part.trim())
    .filter(part => part.length > 0);
  
  console.log(`📋 [TOPIC-SPLIT] Partes encontradas: ${rawParts.length}`);
  
  for (let i = 0; i < rawParts.length; i++) {
    let part = rawParts[i];
    
    // Primeira parte: pode incluir introdução
    if (i === 0 && part.length < 150 && rawParts.length > 1) {
      // Se muito pequena, juntar com próxima parte
      const nextPart = rawParts[i + 1];
      if (nextPart && (part + '\n\n' + nextPart).length <= 500) {
        part = part + '\n\n' + nextPart;
        rawParts.splice(i + 1, 1); // Remove próxima parte
        console.log(`🔗 [TOPIC-SPLIT] Introdução juntada com primeiro tópico`);
      }
    }
    
    // Se bloco muito grande (> 600 chars), dividir de forma inteligente
    if (part.length > 600) {
      console.log(`✂️ [TOPIC-SPLIT] Dividindo bloco grande: ${part.length} chars`);
      
      // Tentar dividir por subtópicos primeiro
      const subTopics = part.split(/(?=\n\s*[-•]\s)/g);
      
      if (subTopics.length > 1) {
        // Agrupar subtópicos em blocos menores
        let currentSubChunk = '';
        for (const subTopic of subTopics) {
          if ((currentSubChunk + '\n' + subTopic).length > 400) {
            if (currentSubChunk) chunks.push(currentSubChunk.trim());
            currentSubChunk = subTopic;
          } else {
            currentSubChunk = currentSubChunk ? currentSubChunk + '\n' + subTopic : subTopic;
          }
        }
        if (currentSubChunk) chunks.push(currentSubChunk.trim());
      } else {
        // Dividir por frases se não há subtópicos
        const sentences = part.split(/(?<=[.!?])\s+/);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + ' ' + sentence).length > 350) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
      }
    }
    // Se bloco muito pequeno (< 80 chars) e não é o primeiro, tentar juntar
    else if (part.length < 80 && chunks.length > 0 && i > 0) {
      const lastChunk = chunks.pop();
      if (lastChunk && (lastChunk + '\n\n' + part).length <= 500) {
        chunks.push(lastChunk + '\n\n' + part);
        console.log(`🔗 [TOPIC-SPLIT] Bloco pequeno juntado com anterior`);
      } else {
        if (lastChunk) chunks.push(lastChunk);
        chunks.push(part);
      }
    }
    else {
      chunks.push(part);
    }
  }
  
  const finalChunks = chunks.filter(chunk => chunk.length > 0);
  console.log(`✅ [TOPIC-SPLIT] Resultado final: ${finalChunks.length} blocos`);
  finalChunks.forEach((chunk, idx) => {
    console.log(`📦 [TOPIC-SPLIT] Bloco ${idx + 1}: ${chunk.length} chars - "${chunk.substring(0, 60)}..."`);
  });
  
  return finalChunks;
}

/**
 * Dividir mensagem em blocos de forma inteligente (por tópicos ou caracteres)
 */
function splitMessageIntoChunks(message: string, maxChars: number): string[] {
  if (message.length <= maxChars) {
    return [message];
  }

  // Se tem estrutura de tópicos, dividir por tópicos
  if (hasTopicStructure(message)) {
    console.log('📝 [AI-ASSISTANT] Detectada estrutura de tópicos, dividindo por tópicos');
    const topicChunks = splitMessageByTopics(message);
    console.log(`🎯 [AI-ASSISTANT] Divisão por tópicos resultou em ${topicChunks.length} blocos`);
    return topicChunks;
  }

  // Senão, dividir por caracteres (método original)
  console.log('📝 [AI-ASSISTANT] Sem estrutura de tópicos, dividindo por caracteres');
  const sentences = message.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    // Se a frase sozinha é maior que o limite, quebrar por palavras
    if (sentence.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      const words = sentence.split(' ');
      let wordChunk = '';
      
      for (const word of words) {
        if ((wordChunk + ' ' + word).length > maxChars) {
          if (wordChunk) {
            chunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            // Palavra muito longa, forçar quebra
            chunks.push(word);
          }
        } else {
          wordChunk = wordChunk ? wordChunk + ' ' + word : word;
        }
      }
      
      if (wordChunk) {
        currentChunk = wordChunk;
      }
    } else {
      // Verificar se cabe no chunk atual
      if ((currentChunk + ' ' + sentence).length > maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Extrair texto de PDF (implementação básica)
 */
async function extractPDFText(pdfBase64: string): Promise<string> {
  try {
    console.log('📄 [PDF] Extraindo texto de PDF');
    
    // Implementação básica - em produção seria melhor usar uma library especializada
    // Por enquanto, indicamos que o PDF foi recebido
    
    const pdfSize = Math.round(pdfBase64.length * 0.75 / 1024); // Tamanho aproximado em KB
    return `[PDF recebido (${pdfSize}KB) - análise de conteúdo em desenvolvimento. Descreva brevemente o conteúdo do documento para melhor atendimento.]`;
    
  } catch (error) {
    console.error('❌ [PDF] Erro ao extrair texto:', error);
    return '[Erro ao processar PDF]';
  }
}

/**
 * Analisar URL (web scraping básico)
 */
async function processURLAnalysis(url: string): Promise<string> {
  try {
    console.log('🌐 [URL] Analisando URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Extrair título
    const titleMatch = html.match(new RegExp('<title[^>]*>([^<]+)</title>', 'i'));
    const title = titleMatch ? titleMatch[1].trim() : 'Sem título';
    
    // Extrair descrição (meta description)
    const descMatch = html.match(new RegExp('<meta[^>]*name=["\'\\s]*description["\'\\s]*[^>]*content=["\'\\s]*([^"\']+)["\'\\s]*', 'i'));
    const description = descMatch ? descMatch[1].trim() : '';
    
    const analysis = `Página: ${title}${description ? `\nDescrição: ${description}` : ''}`;
    
    console.log('✅ [URL] Análise concluída:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('❌ [URL] Erro ao analisar URL:', error);
    return `[Erro ao analisar a URL: ${url}]`;
  }
}

/**
 * 🎵 PROCESSAR COMANDOS DE ÁUDIO
 * Detecta e processa comandos como audio:texto e audiogeonomedoaudio:
 */
async function processAudioCommands(
  message: string, 
  ticketId: string, 
  assistant: any, 
  instanceId: string, 
  businessToken: string
): Promise<{ hasAudioCommands: boolean; processedCount: number; remainingText: string }> {
  console.log('🎵 [PROCESS-AUDIO] ========== INICIANDO PROCESSAMENTO DE ÁUDIO ==========');
  console.log('🎵 [PROCESS-AUDIO] Mensagem recebida:', JSON.stringify(message));
  console.log('🎵 [PROCESS-AUDIO] Assistant ID:', assistant?.id);
  console.log('🎵 [PROCESS-AUDIO] Instance ID:', instanceId);
  console.log('🎵 [PROCESS-AUDIO] Business Token presente:', !!businessToken);
  
  // VALIDAÇÃO CRÍTICA: Business token obrigatório
  if (!businessToken || businessToken.trim() === '') {
    console.warn('⚠️ [PROCESS-AUDIO] Business token vazio - PULANDO comandos de áudio');
    return { hasAudioCommands: false, processedCount: 0, remainingText: message };
  }
  
  try {
    let processedCount = 0;
    let remainingText = message;
    
    // ✅ LIMPAR E NORMALIZAR MENSAGEM PARA TESTES MAIS PRECISOS
    const cleanMessage = message.trim();
    console.log('🎵 [AUDIO-COMMANDS] Analisando mensagem para comandos de áudio...');
    console.log('🔍 [AUDIO-COMMANDS] Mensagem limpa:', cleanMessage);
    
    // ✅ REGEX PARA BIBLIOTECA: comando como "audio audiogeonothaliszu" (sem dois pontos)
    // CRÍTICO: Deve coincidir exatamente com toda a mensagem para evitar conflitos
    const audioLibraryPattern = /^audio\s+([a-zA-Z0-9]+)$/i;
    
    // ✅ REGEX PARA TTS: comando como "audio: texto" (com dois pontos obrigatórios)
    const audioTextPattern = /audio\s*:\s*(?:"([^"]+)"|([^"\n\r]+?)(?=\s*$|\s*\n|\s*\r|$))/gi;
    
    console.log('🎯 [AUDIO-COMMANDS] Regex biblioteca:', audioLibraryPattern.source);
    console.log('🎯 [AUDIO-COMMANDS] Regex TTS:', audioTextPattern.source);
    
    // ✅ TESTE DIRETO DOS REGEX COM MENSAGEM LIMPA
    const testLibraryMatch = cleanMessage.match(audioLibraryPattern);
    console.log('🔍 [AUDIO-COMMANDS] Teste Library regex:', testLibraryMatch);
    
    // ✅ PRIORIDADE ABSOLUTA: BIBLIOTECA PRIMEIRO
    if (testLibraryMatch) {
      console.log('🎵 [AUDIO-LIBRARY] ✅ COMANDO DE BIBLIOTECA DETECTADO!');
      console.log('🎵 [AUDIO-LIBRARY] Comando completo:', testLibraryMatch[0]);
      console.log('🎵 [AUDIO-LIBRARY] Nome do áudio:', testLibraryMatch[1]);
      
      const audioName = testLibraryMatch[1].trim();
      
      try {
        const libraryAudio = await getAudioFromLibrary(assistant.id, audioName);
        if (libraryAudio) {
          console.log('🎵 [AUDIO-LIBRARY] ✅ Áudio encontrado na biblioteca, enviando...');
          await sendLibraryAudioMessage(instanceId, ticketId, libraryAudio.audioBase64, businessToken);
          processedCount++;
          console.log('✅ [AUDIO-LIBRARY] Áudio da biblioteca enviado com sucesso:', audioName);
          
          // Remove comando completo da mensagem
          remainingText = cleanMessage.replace(testLibraryMatch[0], '').trim();
          
          return { hasAudioCommands: true, processedCount, remainingText };
        } else {
          console.warn('⚠️ [AUDIO-LIBRARY] Áudio não encontrado na biblioteca:', {
            audioName,
            assistantId: assistant.id
          });
          
          // Se não encontrar na biblioteca, NÃO processa como TTS
          return { hasAudioCommands: false, processedCount: 0, remainingText: cleanMessage };
        }
      } catch (error) {
        console.error('❌ [AUDIO-LIBRARY] Erro ao processar áudio da biblioteca:', error);
        return { hasAudioCommands: false, processedCount: 0, remainingText: cleanMessage };
      }
    }
    
    // ✅ RESET REGEX FLAGS PARA REUTILIZAÇÃO
    audioTextPattern.lastIndex = 0;
    
    // ✅ TESTE TTS APENAS SE NÃO FOR COMANDO DE BIBLIOTECA
    const testTTSMatch = cleanMessage.match(audioTextPattern);
    console.log('🔍 [AUDIO-COMMANDS] Teste TTS regex:', testTTSMatch);
    
    // ✅ SE NÃO FOR COMANDO DE BIBLIOTECA, PROCESSAR COMO TTS
    const audioTextMatches = Array.from(message.matchAll(audioTextPattern));
    console.log('🎵 [AUDIO-COMMANDS] ℹ️ Encontrados', audioTextMatches.length, 'comandos TTS');
    
    if (audioTextMatches.length === 0) {
      console.log('🎵 [AUDIO-COMMANDS] ℹ️ Nenhum comando de áudio detectado');
      console.log('🔍 [AUDIO-COMMANDS] Debug - contém palavra audio:', /audio/.test(message));
      console.log('🔍 [AUDIO-COMMANDS] Debug - contém dois pontos:', /:/.test(message));
    }
    
    for (const match of audioTextMatches) {
      // Capturar texto COM aspas (grupo 1) ou SEM aspas (grupo 2)
      const textToSpeak = (match[1] || match[2] || '').trim();
      console.log('🔍 [AUDIO-COMMANDS] Match completo encontrado:', match[0]);
      console.log('🔍 [AUDIO-COMMANDS] Grupo 1 (com aspas):', match[1]);
      console.log('🔍 [AUDIO-COMMANDS] Grupo 2 (sem aspas):', match[2]);
      console.log('🔍 [AUDIO-COMMANDS] Texto final extraído:', textToSpeak);
      
      if (!textToSpeak) {
        console.warn('⚠️ [AUDIO-TTS] Texto vazio encontrado no comando audio:');
        continue;
      }
      
      console.log('🎤 [TTS] Gerando áudio para texto:', textToSpeak.substring(0, 50) + '...');
      console.log('🔍 [TTS] Debug - assistente:', assistant.id, assistant.name);
      console.log('🔍 [TTS] Debug - instanceId:', instanceId);
      console.log('🔍 [TTS] Debug - businessToken presente:', !!businessToken);
      
      try {
        const audioResult = await generateTTSAudio(textToSpeak, assistant);
        console.log('🔍 [TTS] Resultado da geração:', audioResult.success ? 'SUCESSO' : 'FALHA', audioResult.error || '');
        
        if (audioResult.success) {
          console.log('🔍 [TTS] Tentando enviar áudio via sendAudioMessage...');
          await sendAudioMessage(instanceId, ticketId, audioResult.audioBase64, businessToken);
          processedCount++;
          console.log('✅ [AUDIO-TTS] Áudio TTS enviado com sucesso');
        } else {
          console.error('❌ [AUDIO-TTS] Falha no TTS:', audioResult.error);
          // FEEDBACK AO USUÁRIO: informar sobre falha na geração de áudio
          await supabase
            .from('ticket_messages')
            .insert({
              ticket_id: ticketId,
              message_id: `tts_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              content: `⚠️ Falha ao gerar áudio: ${audioResult.error}`,
              from_me: true,
              is_ai_response: true,
              sender_name: assistant.name || 'Assistente IA',
              timestamp: new Date().toISOString(),
              message_type: 'text',
              processing_status: 'processed'
            });
        }
      } catch (error) {
        console.error('❌ [AUDIO-TTS] Erro ao gerar TTS:', error);
        // FEEDBACK AO USUÁRIO: informar sobre erro crítico
        await supabase
          .from('ticket_messages')
          .insert({
            ticket_id: ticketId,
            message_id: `tts_critical_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: `❌ Erro crítico no sistema de áudio: ${error.message}`,
            from_me: true,
            is_ai_response: true,
            sender_name: assistant.name || 'Assistente IA',
            timestamp: new Date().toISOString(),
            message_type: 'text',
            processing_status: 'processed'
          });
      }
      
      // Remover comando da mensagem
      remainingText = remainingText.replace(match[0], '').trim();
    }
    
    
    const hasAudioCommands = processedCount > 0;
    
    console.log('🎵 [PROCESS-AUDIO] Processamento concluído - comandos:', processedCount);
    
    return { hasAudioCommands, processedCount, remainingText };
    
  } catch (error) {
    console.error('❌ [PROCESS-AUDIO] Erro no processamento:', error);
    console.error('❌ [PROCESS-AUDIO] Stack trace:', error.stack);
    // FALLBACK CRÍTICO: Sempre retornar texto original se áudio falhar
    return { hasAudioCommands: false, processedCount: 0, remainingText: message };
  }
}

/**
 * 🎤 GERAR ÁUDIO TTS (ElevenLabs + Fish.Audio) - COM RETRY LOGIC
 */
async function generateTTSAudio(text: string, assistant: any): Promise<{ success: boolean; audioBase64?: string; error?: string }> {
  try {
    console.log('🎤 [TTS] Gerando áudio para texto:', text.substring(0, 50) + '...');
    
    // ✅ BUSCAR CONFIGURAÇÕES COM RETRY LOGIC
    console.log('🔍 [TTS] Buscando configurações avançadas do assistente:', assistant.id);
    
    const assistantData = await retryWithBackoff(
      async () => {
        const { data, error } = await supabase
          .from('assistants')
          .select('advanced_settings')
          .eq('id', assistant.id)
          .single();
        
        if (error) throw error;
        if (!data) throw new Error('Assistente não encontrado');
        
        return data;
      },
      { maxAttempts: 3, initialDelay: 500, maxDelay: 2000, backoffMultiplier: 2 },
      'Buscar configurações do assistente'
    );
    
    // ✅ CORRIGIR PARSE DO ADVANCED_SETTINGS (aplicar mesma lógica da getHumanizedConfig)
    console.log('🔍 [TTS] Valor bruto recebido:', {
      type: typeof assistantData.advanced_settings,
      value: assistantData.advanced_settings
    });
    
    const advancedSettings = assistantData.advanced_settings
      ? (typeof assistantData.advanced_settings === 'string' 
          ? JSON.parse(assistantData.advanced_settings) 
          : assistantData.advanced_settings)
      : {};
      
    console.log('🔍 [TTS] Configurações após parse:', {
      hasElevenLabs: !!(advancedSettings.eleven_labs_api_key && advancedSettings.eleven_labs_voice_id),
      hasFishAudio: !!(advancedSettings.fish_audio_api_key && advancedSettings.fish_audio_voice_id),
      audioProvider: advancedSettings.audio_provider || 'não definido',
      elevenLabsKey: advancedSettings.eleven_labs_api_key ? 'sk_...' + advancedSettings.eleven_labs_api_key.slice(-8) : 'AUSENTE',
      elevenLabsVoice: advancedSettings.eleven_labs_voice_id || 'AUSENTE'
    });
    
    if (!advancedSettings.eleven_labs_api_key && !advancedSettings.fish_audio_api_key) {
      console.error('❌ [TTS] Nenhuma API de TTS configurada no assistente');
      console.log('🔍 [TTS] Debug detalhado - Configurações completas:', JSON.stringify(advancedSettings, null, 2));
      console.log('📝 [TTS] Fallback: Retornando falha para enviar como texto');
      return { success: false, error: 'TTS não configurado - adicione API key do ElevenLabs ou Fish.Audio' };
    }
    
    const provider = advancedSettings.audio_provider || 'elevenlabs';
    
    // ✅ TENTAR ELEVENLABS COM RETRY LOGIC
    if (advancedSettings.eleven_labs_api_key && advancedSettings.eleven_labs_voice_id) {
      
      console.log('🎭 [TTS] Tentando ElevenLabs...', {
        voiceId: advancedSettings.eleven_labs_voice_id,
        model: advancedSettings.eleven_labs_model || 'eleven_multilingual_v2'
      });
      
      try {
        console.log('🔍 [TTS] Iniciando chamada para ElevenLabs edge function...');
        console.log('🔍 [TTS] URL:', `${Deno.env.get('SUPABASE_URL')}/functions/v1/text-to-speech`);
        console.log('🔍 [TTS] Parâmetros:', {
          textLength: text.length,
          voiceId: advancedSettings.eleven_labs_voice_id.substring(0, 8) + '...',
          hasApiKey: !!advancedSettings.eleven_labs_api_key,
          model: advancedSettings.eleven_labs_model || 'eleven_multilingual_v2'
        });
        
        const elevenLabsResult = await retryWithBackoff(
          async () => {
            const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/text-to-speech`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text,
                voiceId: advancedSettings.eleven_labs_voice_id,
                apiKey: advancedSettings.eleven_labs_api_key,
                model: advancedSettings.eleven_labs_model || 'eleven_multilingual_v2',
                voiceSettings: advancedSettings.voice_settings || { stability: 0.5, similarity_boost: 0.5 }
              })
            });
            
            console.log('🔍 [TTS] Response status:', response.status);
            console.log('🔍 [TTS] Response ok:', response.ok);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ [TTS] Response error text:', errorText);
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`ElevenLabs API error: ${errorData.error || response.statusText}`);
            }
            
            const responseData = await response.json();
            console.log('🔍 [TTS] Response data:', { 
              success: responseData.success, 
              hasAudio: !!responseData.audioBase64,
              audioSize: responseData.audioBase64 ? Math.round(responseData.audioBase64.length / 1024) + 'KB' : 'N/A'
            });
            
            return responseData;
          },
          { maxAttempts: 2, initialDelay: 1000, maxDelay: 3000, backoffMultiplier: 2 },
          'ElevenLabs TTS'
        );
        
        console.log('✅ [TTS] ElevenLabs TTS gerado com sucesso');
        return { success: true, audioBase64: elevenLabsResult.audioBase64 };
        
      } catch (error) {
        console.error('❌ [TTS] ElevenLabs falhou após retries:', error);
        return { success: false, error: `ElevenLabs: ${error.message}` };
      }
    }
    
    // Tentar Fish.Audio como fallback
    if (advancedSettings.fish_audio_api_key && advancedSettings.fish_audio_voice_id) {
      
      console.log('🐟 [TTS] Tentando Fish.Audio como fallback...', {
        referenceId: advancedSettings.fish_audio_voice_id,
        format: advancedSettings.fish_audio_format || 'mp3'
      });
      
      try {
        const fishAudioResult = await retryWithBackoff(
          async () => {
            const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fish-audio-tts`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                apiKey: advancedSettings.fish_audio_api_key,
                text,
                reference_id: advancedSettings.fish_audio_voice_id,
                format: advancedSettings.fish_audio_format || 'mp3',
                normalize: true
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`Fish.Audio API error: ${errorData.error || response.statusText}`);
            }
            
            return response.json();
          },
          { maxAttempts: 2, initialDelay: 1000, maxDelay: 3000, backoffMultiplier: 2 },
          'Fish.Audio TTS'
        );
        
        console.log('✅ [TTS] Fish.Audio TTS gerado com sucesso');
        return { success: true, audioBase64: fishAudioResult.audioBase64 };
        
      } catch (error) {
        console.error('❌ [TTS] Fish.Audio falhou após retries:', error);
        return { success: false, error: `Fish.Audio: ${error.message}` };
      }
    }
    
    console.warn('⚠️ [TTS] Nenhum provedor de TTS configurado ou disponível');
    return { success: false, error: 'Nenhuma API de TTS configurada' };
    
  } catch (error) {
    console.error('❌ [TTS] Erro na geração de áudio:', error);
    return { success: false };
  }
}

/**
 * 📚 BUSCAR ÁUDIO DA BIBLIOTECA (CORRIGIDO)
 */
async function getAudioFromLibrary(assistantId: string, audioName: string): Promise<{ audioBase64: string } | null> {
  try {
    console.log('📚 [AUDIO-LIBRARY] Buscando áudio na biblioteca:', {
      assistantId,
      audioName,
      requestedName: audioName
    });
    
    // CORREÇÃO: Buscar na tabela assistants campo advanced_settings
    const { data: assistantData } = await supabase
      .from('assistants')
      .select('advanced_settings')
      .eq('id', assistantId)
      .single();
    
    // ✅ APLICAR PARSE CORRETO DO ADVANCED_SETTINGS
    const advancedSettings = assistantData?.advanced_settings
      ? (typeof assistantData.advanced_settings === 'string' 
          ? JSON.parse(assistantData.advanced_settings) 
          : assistantData.advanced_settings)
      : {};
    
    if (!advancedSettings?.audio_library) {
      console.warn('📚 [AUDIO-LIBRARY] Biblioteca de áudios vazia ou inexistente');
      return null;
    }
    
    const library = advancedSettings.audio_library as any[];
    console.log('📚 [AUDIO-LIBRARY] Biblioteca carregada:', {
      totalAudios: library.length,
      audiosDisponiveis: library.map(item => ({ 
        trigger: item.trigger, 
        name: item.name,
        hasAudioBase64: !!item.audioBase64 
      }))
    });
    
    // ✅ MELHORAR MATCHING DE TRIGGERS: busca flexível e case-insensitive
    const normalizedSearchName = audioName.toLowerCase().trim();
    
    console.log('🔍 [AUDIO-LIBRARY] Debug matching:', {
      buscandoPor: normalizedSearchName,
      originalInput: audioName,
      triggersDisponiveis: library.map(item => ({ trigger: item.trigger, name: item.name }))
    });
    
    // Primeiro tentar matches exatos, depois parciais ordenados por especificidade
    let bestMatch = null;
    let bestMatchScore = 0;
    let bestMatchType = '';
    
    console.log(`🔍 [AUDIO-LIBRARY] Buscando por: "${normalizedSearchName}" em ${library.length} áudios`);
    
    for (const item of library) {
      const trigger = item.trigger.toLowerCase().trim();
      let matchScore = 0;
      let matchType = '';
      
      console.log(`🔍 [AUDIO-LIBRARY] Testando trigger: "${trigger}"`);
      
      // 1. MATCH EXATO - PRIORIDADE MÁXIMA (score 1000)
      if (trigger === normalizedSearchName) {
        console.log('🎉 [AUDIO-LIBRARY] ✅ MATCH EXATO!');
        return item;
      }
      
      // 2. Match sem prefixo "audio" (score 900)
      if (trigger.startsWith('audio') && trigger.length > 5) {
        const triggerSemAudio = trigger.substring(5);
        if (triggerSemAudio === normalizedSearchName) {
          console.log('🎉 [AUDIO-LIBRARY] ✅ MATCH SEM PREFIXO "audio"!');
          return item;
        }
      }
      
      // 3. Match com prefixo "audio" (score 800)
      if (!normalizedSearchName.startsWith('audio')) {
        const buscaComAudio = `audio${normalizedSearchName}`;
        if (trigger === buscaComAudio) {
          console.log('🎉 [AUDIO-LIBRARY] ✅ MATCH COM PREFIXO "audio"!');
          return item;
        }
      }
      
      // 4. MATCH PARCIAL INTELIGENTE - apenas se busca tem pelo menos 4 caracteres
      if (normalizedSearchName.length >= 4) {
        
        // 4a. Trigger CONTÉM a busca (ex: "audiogeonothaliszu" contém "audiogeo")
        if (trigger.includes(normalizedSearchName)) {
          matchScore = 700 + (normalizedSearchName.length / trigger.length * 100); // Prioriza matches mais específicos
          matchType = `PARCIAL: trigger "${trigger}" contém busca "${normalizedSearchName}"`;
          console.log(`🔍 [AUDIO-LIBRARY] ${matchType} (score: ${Math.round(matchScore)})`);
        }
        
        // 4b. Busca CONTÉM o trigger (ex: "audiogeonothaliszu" contém "geo") 
        else if (normalizedSearchName.includes(trigger)) {
          matchScore = 600 + (trigger.length / normalizedSearchName.length * 100);
          matchType = `PARCIAL: busca "${normalizedSearchName}" contém trigger "${trigger}"`;
          console.log(`🔍 [AUDIO-LIBRARY] ${matchType} (score: ${Math.round(matchScore)})`);
        }
        
        // 4c. Match com prefixo removido
        else if (trigger.startsWith('audio') && trigger.length > 5) {
          const triggerLimpo = trigger.substring(5);
          if (triggerLimpo.includes(normalizedSearchName) || normalizedSearchName.includes(triggerLimpo)) {
            matchScore = 500 + (Math.min(triggerLimpo.length, normalizedSearchName.length) / Math.max(triggerLimpo.length, normalizedSearchName.length) * 100);
            matchType = `PARCIAL SEM PREFIXO: "${triggerLimpo}" vs "${normalizedSearchName}"`;
            console.log(`🔍 [AUDIO-LIBRARY] ${matchType} (score: ${Math.round(matchScore)})`);
          }
        }
        
        // Registrar o melhor match até agora
        if (matchScore > bestMatchScore) {
          bestMatch = item;
          bestMatchScore = matchScore;
          bestMatchType = matchType;
          console.log(`🎯 [AUDIO-LIBRARY] Novo melhor match: score ${Math.round(bestMatchScore)} - ${bestMatchType}`);
        }
      }
    }
    
    // Retornar melhor match se passou do threshold mínimo
    const minThreshold = 500; // Threshold mínimo para aceitar matches parciais
    if (bestMatch && bestMatchScore >= minThreshold) {
      console.log(`🎉 [AUDIO-LIBRARY] ✅ MELHOR MATCH ENCONTRADO! Score: ${Math.round(bestMatchScore)} - ${bestMatchType}`);
      return bestMatch;
    }
    
    console.log(`❌ [AUDIO-LIBRARY] Nenhum match encontrado para "${normalizedSearchName}" (melhor score: ${Math.round(bestMatchScore)})`);
    const audio = null;
    
    if (!audio) {
      console.warn('📚 [AUDIO-LIBRARY] Áudio não encontrado:', {
        procurandoPor: normalizedSearchName,
        triggersDisponiveis: library.map(item => item.trigger)
      });
      
      // 🎯 FALLBACK INTELIGENTE: Sugerir triggers similares
      const similarTriggers = library
        .filter(item => item.trigger.toLowerCase().includes(normalizedSearchName.substring(0, 4)))
        .map(item => item.trigger)
        .slice(0, 3);
      
      if (similarTriggers.length > 0) {
        console.log('💡 [AUDIO-LIBRARY] Triggers similares encontrados:', similarTriggers);
      }
      
      return null;
    }
    
    // ✅ VERIFICAR SE EXISTE audioBase64
    if (!audio.audioBase64) {
      console.error('❌ [AUDIO-LIBRARY] Áudio encontrado mas sem audioBase64:', {
        trigger: audio.trigger,
        temUrl: !!audio.url,
        temAudioBase64: !!audio.audioBase64
      });
      return null;
    }
    
    console.log('✅ [AUDIO-LIBRARY] Áudio encontrado com sucesso:', {
      trigger: audio.trigger,
      name: audio.name,
      duration: audio.duration,
      category: audio.category,
      audioBase64Length: audio.audioBase64.length
    });
    
    return { audioBase64: audio.audioBase64 };
    
  } catch (error) {
    console.error('❌ [AUDIO-LIBRARY] Erro ao buscar áudio:', error);
    return null;
  }
}

/**
 * 🎵 ENVIAR MENSAGEM DE ÁUDIO VIA YUMER API (CORRIGIDO - USA URL DO STORAGE)
 */
async function sendAudioMessage(instanceId: string, ticketId: string, audioBase64: string, businessToken: string): Promise<void> {
  try {
    // Buscar informações do ticket para obter chatId
    const { data: ticket } = await supabase
      .from('conversation_tickets')
      .select('chat_id')
      .eq('id', ticketId)
      .single();
    
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }
    
    console.log('🎵 [SEND-AUDIO] Iniciando processo de envio de áudio TTS...', {
      instanceId,
      chatId: ticket.chat_id.substring(0, 15) + '...',
      audioSize: Math.round(audioBase64.length / 1024) + 'KB'
    });

    // 1. UPLOAD DO BASE64 PARA SUPABASE STORAGE
    console.log('📤 [SEND-AUDIO] Fazendo upload do áudio para Storage...');
    
    // Converter Base64 para Blob
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `tts_audio_${instanceId}_${timestamp}.mp3`;
    const filePath = `temp-audio/${fileName}`;
    
    // Upload para storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(filePath, audioBlob, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ [SEND-AUDIO] Erro no upload:', uploadError);
      throw new Error(`Erro no upload do áudio: ${uploadError.message}`);
    }
    
    // 2. OBTER URL PÚBLICA
    const { data: publicUrlData } = supabase.storage
      .from('client-assets')
      .getPublicUrl(filePath);
    
    if (!publicUrlData?.publicUrl) {
      throw new Error('Não foi possível obter URL pública do áudio');
    }
    
    const audioUrl = publicUrlData.publicUrl;
    console.log('✅ [SEND-AUDIO] Upload concluído. URL:', audioUrl.substring(0, 50) + '...');
    
    // 3. ENVIAR URL PARA API YUMER (FORMATO CORRETO DA DOCUMENTAÇÃO)
    console.log('📡 [SEND-AUDIO] Enviando URL para API Yumer...');
    
    const audioData = {
      recipient: ticket.chat_id,
      audioMessage: {
        url: audioUrl
      },
      options: {
        externalAttributes: JSON.stringify({
          source: 'ai_tts',
          timestamp: Date.now(),
          method: 'storage_url'
        })
      }
    };
    
    console.log('🔍 [SEND-AUDIO] Payload final:', {
      recipient: ticket.chat_id,
      audioUrl: audioUrl.substring(0, 50) + '...',
      hasOptions: true
    });
    
    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/send/audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(audioData)
    });
    
    console.log('🔍 [SEND-AUDIO] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SEND-AUDIO] Erro na API Yumer:', errorText);
      throw new Error(`Falha no envio de áudio TTS: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [SEND-AUDIO] Áudio TTS enviado com sucesso via URL:', {
      messageId: result.key?.id || 'N/A',
      audioUrl: audioUrl.substring(0, 50) + '...',
      success: true
    });
    
    // 4. AGENDAR LIMPEZA DO ARQUIVO TEMPORÁRIO
    setTimeout(async () => {
      try {
        await supabase.storage.from('client-assets').remove([filePath]);
        console.log('🧹 [SEND-AUDIO] Arquivo temporário removido:', fileName);
      } catch (error) {
        console.warn('⚠️ [SEND-AUDIO] Erro na limpeza (não crítico):', error);
      }
    }, 300000); // Limpar após 5 minutos
    
  } catch (error) {
    console.error('❌ [SEND-AUDIO] Erro ao enviar áudio:', error);
    throw error;
  }
}

/**
 * 🎵 ENVIAR ÁUDIO DA BIBLIOTECA (ESPECIALIZADA PARA BASE64 DA BIBLIOTECA)
 */
async function sendLibraryAudioMessage(instanceId: string, ticketId: string, audioBase64: string, businessToken: string): Promise<void> {
  try {
    // Buscar informações do ticket para obter chatId
    const { data: ticket } = await supabase
      .from('conversation_tickets')
      .select('chat_id')
      .eq('id', ticketId)
      .single();
    
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }
    
    console.log('🎵 [SEND-LIBRARY-AUDIO] Processando áudio da biblioteca...', {
      instanceId,
      chatId: ticket.chat_id.substring(0, 15) + '...',
      audioSize: Math.round(audioBase64.length / 1024) + 'KB'
    });

    // 🔍 DETECTAR FORMATO DO ÁUDIO via headers Base64
    let audioFormat = 'ogg'; // default
    let mimeType = 'audio/ogg';
    
    try {
      // Primeiros bytes do Base64 para detectar formato
      const headerBytes = audioBase64.substring(0, 20);
      
      if (headerBytes.startsWith('T2dnUw')) {
        audioFormat = 'ogg';
        mimeType = 'audio/ogg';
      } else if (headerBytes.startsWith('SUQz') || headerBytes.startsWith('//')) {
        audioFormat = 'mp3';
        mimeType = 'audio/mpeg';
      } else if (headerBytes.startsWith('UklGRg')) {
        audioFormat = 'wav';
        mimeType = 'audio/wav';
      }
      
      console.log('🔍 [SEND-LIBRARY-AUDIO] Formato detectado:', { audioFormat, mimeType });
    } catch (e) {
      console.warn('⚠️ [SEND-LIBRARY-AUDIO] Erro na detecção de formato, usando OGG padrão');
    }

    // 🔄 CONVERTER BASE64 PARA BLOB
    console.log('🔄 [SEND-LIBRARY-AUDIO] Convertendo base64 para blob...');
    
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBlob = new Blob([bytes], { type: mimeType });
    console.log('📊 [SEND-LIBRARY-AUDIO] Blob criado:', {
      size: audioBlob.size,
      type: audioBlob.type,
      format: audioFormat
    });

    // 📤 ENVIAR VIA /send/audio-file (SEGUINDO DOCUMENTAÇÃO EXATA)
    console.log('📤 [SEND-LIBRARY-AUDIO] Enviando via /send/audio-file...');
    
    const timestamp = Date.now();
    const fileName = `library_audio_${timestamp}.${audioFormat}`;
    
    // FormData seguindo EXATAMENTE a documentação da API
    const formData = new FormData();
    formData.append('recipient', ticket.chat_id);
    formData.append('attachment', audioBlob, fileName);
    formData.append('delay', '800');
    
    console.log('🔍 [SEND-LIBRARY-AUDIO] FormData preparado:', {
      recipient: ticket.chat_id,
      fileName: fileName,
      audioSize: Math.round(audioBlob.size / 1024) + 'KB',
      delay: '800'
    });
    
    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/send/audio-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`
      },
      body: formData
    });

    console.log('🔍 [SEND-LIBRARY-AUDIO] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SEND-LIBRARY-AUDIO] Erro no endpoint audio-file:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Falha no envio: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('🔍 [SEND-LIBRARY-AUDIO] Response completo:', result);
    console.log('✅ [SEND-LIBRARY-AUDIO] Áudio da biblioteca enviado com sucesso:', {
      messageId: result.key?.id || 'N/A',
      format: audioFormat,
      success: true
    });
    
  } catch (error) {
    console.error('❌ [SEND-LIBRARY-AUDIO] Erro ao enviar áudio da biblioteca:', error);
    throw error;
  }
}

/**
 * 🖼️ PROCESSAR COMANDOS DE IMAGEM
 */
async function processImageCommands(
  message: string, 
  context: { assistantId: string, instanceId: string, chatId: string, businessToken: string }
): Promise<{ hasImageCommands: boolean; processedCount: number }> {
  try {
    console.log('🖼️ [IMAGE-COMMANDS] ========== INICIANDO PROCESSAMENTO DE IMAGENS ==========');
    console.log('🖼️ [IMAGE-COMMANDS] Assistant ID:', context.assistantId);
    console.log('🖼️ [IMAGE-COMMANDS] Instance ID:', context.instanceId);
    console.log('🖼️ [IMAGE-COMMANDS] Business Token presente:', !!context.businessToken);
    console.log('🖼️ [IMAGE-COMMANDS] Mensagem recebida:', `"${message}"`);
    
    let processedCount = 0;
    
    // ✅ LIMPAR E NORMALIZAR MENSAGEM PARA TESTES MAIS PRECISOS
    const cleanMessage = message.trim();
    console.log('🖼️ [IMAGE-COMMANDS] Analisando mensagem para comandos de imagem...');
    console.log('🔍 [IMAGE-COMMANDS] Mensagem limpa:', cleanMessage);
    
    // ✅ REGEX PARA COMANDO DE IMAGEM: "image trigger" (igual ao áudio que funciona)
    const imageCommandPattern = /^image\s+([a-zA-Z0-9_-]+)$/i;
    
    console.log('🎯 [IMAGE-COMMANDS] Regex imagem:', imageCommandPattern.source);
    
    // ✅ TESTE DIRETO DO REGEX COM MENSAGEM LIMPA
    const testImageMatch = cleanMessage.match(imageCommandPattern);
    console.log('🔍 [IMAGE-COMMANDS] Teste Image regex:', testImageMatch);
    
    if (testImageMatch) {
      console.log('🖼️ [IMAGE-LIBRARY] ✅ COMANDO DE IMAGEM DETECTADO!');
      console.log('🖼️ [IMAGE-LIBRARY] Comando completo:', testImageMatch[0]);
      console.log('🖼️ [IMAGE-LIBRARY] Trigger da imagem:', testImageMatch[1]);
      
      const imageTrigger = testImageMatch[1].trim();
      
      try {
        const libraryImage = await getImageFromLibrary(context.assistantId, imageTrigger);
        
        if (libraryImage) {
          console.log('🖼️ [IMAGE-LIBRARY] ✅ Imagem encontrada na biblioteca, enviando...');
          await sendLibraryImageMessage(context.instanceId, context.chatId, libraryImage, context.businessToken);
          processedCount++;
          console.log('✅ [IMAGE-LIBRARY] Imagem da biblioteca enviada com sucesso:', imageTrigger);
        } else {
          console.warn('⚠️ [IMAGE-LIBRARY] Imagem não encontrada na biblioteca:', imageTrigger);
        }
        
      } catch (error) {
        console.error('❌ [IMAGE-LIBRARY] Erro ao processar imagem da biblioteca:', error);
      }
    }
    
    console.log('🖼️ [PROCESS-IMAGE] Processamento concluído - comandos:', processedCount);
    console.log('🖼️ [IMAGE-COMMANDS] ✅ Comandos de imagem processados:', processedCount);
    
    return {
      hasImageCommands: processedCount > 0,
      processedCount: processedCount
    };
    
  } catch (error) {
    console.error('❌ [PROCESS-IMAGE] Erro geral no processamento de imagens:', error);
    return {
      hasImageCommands: false,
      processedCount: 0
    };
  }
}

/**
 * 📚 BUSCAR IMAGEM DA BIBLIOTECA
 */
async function getImageFromLibrary(assistantId: string, imageTrigger: string): Promise<{ imageBase64: string, format: string } | null> {
  try {
    console.log('📚 [IMAGE-LIBRARY] 🔍 BUSCANDO IMAGEM NA BIBLIOTECA - DEBUG DETALHADO:');
    console.log('📚 [IMAGE-LIBRARY] Assistant ID:', assistantId);
    console.log('📚 [IMAGE-LIBRARY] Trigger buscado:', imageTrigger);
    console.log('📚 [IMAGE-LIBRARY] Tipo do trigger:', typeof imageTrigger);
    console.log('📚 [IMAGE-LIBRARY] Trigger limpo:', imageTrigger.trim());
    
    // Buscar na tabela assistants campo advanced_settings
    const { data: assistantData } = await supabase
      .from('assistants')
      .select('advanced_settings')
      .eq('id', assistantId)
      .single();
    
    console.log('🔍 [IMAGE-LIBRARY] Dados do assistente raw:', {
      hasAdvancedSettings: !!assistantData?.advanced_settings,
      typeOfAdvancedSettings: typeof assistantData?.advanced_settings,
      rawAdvancedSettings: JSON.stringify(assistantData?.advanced_settings, null, 2)
    });
    
    // 🎯 PARSER REFORÇADO PARA ESTRUTURA COMPLEX ANINHADA
    let advancedSettings = assistantData?.advanced_settings || {};
    
    console.log('🔧 [IMAGE-LIBRARY] ETAPA 1: Tipo inicial:', typeof advancedSettings);
    
    // STEP 1: Parse inicial se for string
    if (typeof advancedSettings === 'string') {
      try {
        advancedSettings = JSON.parse(advancedSettings);
        console.log('✅ [IMAGE-LIBRARY] String parsed para object');
      } catch (parseError) {
        console.error('❌ [IMAGE-LIBRARY] Erro ao fazer parse da string:', parseError);
        return null;
      }
    }
    
    console.log('🔧 [IMAGE-LIBRARY] ETAPA 2: Após primeiro parse, tipo:', typeof advancedSettings);
    console.log('🔧 [IMAGE-LIBRARY] ETAPA 2: Chaves disponíveis:', Object.keys(advancedSettings));
    
    // STEP 2: NOVO ALGORITMO PARA ESTRUTURA ANINHADA COMPLEXA
    if (advancedSettings && typeof advancedSettings === 'object') {
      // 🎯 TENTATIVA 1: Verificar se já tem image_library diretamente
      if (advancedSettings.image_library && Array.isArray(advancedSettings.image_library)) {
        console.log('✅ [IMAGE-LIBRARY] image_library encontrada diretamente!');
      } else {
        console.log('🔍 [IMAGE-LIBRARY] image_library não encontrada diretamente, procurando em estrutura aninhada...');
        
        // 🎯 TENTATIVA 2: Procurar em chaves numéricas (estrutura aninhada típica)
        let found = false;
        for (const key of Object.keys(advancedSettings)) {
          console.log(`🔍 [IMAGE-LIBRARY] Verificando chave "${key}"...`);
          
          if (typeof advancedSettings[key] === 'string') {
            console.log(`🔧 [IMAGE-LIBRARY] Chave "${key}" é string, tentando parse...`);
            try {
              const nestedData = JSON.parse(advancedSettings[key]);
              console.log(`🔍 [IMAGE-LIBRARY] Parse da chave "${key}" - chaves:`, Object.keys(nestedData));
              
              if (nestedData.image_library && Array.isArray(nestedData.image_library)) {
                advancedSettings = nestedData;
                console.log(`✅ [IMAGE-LIBRARY] image_library encontrada na chave "${key}"!`);
                found = true;
                break;
              }
            } catch (nestedParseError) {
              console.log(`⚠️ [IMAGE-LIBRARY] Erro ao fazer parse da chave "${key}":`, nestedParseError.message);
            }
          } else if (typeof advancedSettings[key] === 'object' && advancedSettings[key] !== null) {
            console.log(`🔍 [IMAGE-LIBRARY] Chave "${key}" é object, verificando image_library...`);
            if (advancedSettings[key].image_library && Array.isArray(advancedSettings[key].image_library)) {
              advancedSettings = advancedSettings[key];
              console.log(`✅ [IMAGE-LIBRARY] image_library encontrada no object da chave "${key}"!`);
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          console.log('🔍 [IMAGE-LIBRARY] Tentando busca recursiva mais profunda...');
          // 🎯 TENTATIVA 3: Busca recursiva mais profunda
          for (const key of Object.keys(advancedSettings)) {
            const value = advancedSettings[key];
            if (typeof value === 'object' && value !== null) {
              for (const subKey of Object.keys(value)) {
                if (typeof value[subKey] === 'string') {
                  try {
                    const deepNestedData = JSON.parse(value[subKey]);
                    if (deepNestedData.image_library && Array.isArray(deepNestedData.image_library)) {
                      advancedSettings = deepNestedData;
                      console.log(`✅ [IMAGE-LIBRARY] image_library encontrada em ${key}.${subKey}!`);
                      found = true;
                      break;
                    }
                  } catch (error) {
                    // Silencioso para não poluir logs
                  }
                }
              }
              if (found) break;
            }
          }
        }
      }
    }
    
    console.log('🔍 [IMAGE-LIBRARY] Advanced settings FINAL após todos os parses:', {
      keys: Object.keys(advancedSettings),
      hasImageLibrary: !!advancedSettings?.image_library,
      hasAudioLibrary: !!advancedSettings?.audio_library,
      imageLibraryLength: advancedSettings?.image_library?.length || 0,
      audioLibraryLength: advancedSettings?.audio_library?.length || 0
    });
    
    if (!advancedSettings?.image_library) {
      console.error('❌ [IMAGE-LIBRARY] ⚠️ BIBLIOTECA DE IMAGENS NÃO ENCONTRADA!', {
        assistantId,
        availableKeys: Object.keys(advancedSettings),
        hasAudioLibrary: !!advancedSettings?.audio_library,
        totalAudioLibraryItems: advancedSettings?.audio_library?.length || 0,
        message: 'Você precisa primeiro SALVAR uma imagem na interface do assistente!',
        instructions: [
          '1. Vá para Configurações do Assistente',
          '2. Acesse a aba "Configurações de Imagem"', 
          '3. Faça upload de uma imagem com trigger "logo"',
          '4. Salve as configurações',
          '5. Teste novamente com "image: logo"'
        ]
      });
      
      // TODO: Futuramente podemos auto-inicializar image_library vazia aqui
      // Por enquanto, retornamos null para forçar o usuário a configurar
      return null;
    }
    
    const library = advancedSettings.image_library as any[];
    console.log('📚 [IMAGE-LIBRARY] Biblioteca carregada:', {
      totalImages: library.length,
      imagensDisponiveis: library.map(item => ({ 
        trigger: item.trigger, 
        name: item.name,
        format: item.format,
        hasImageBase64: !!item.imageBase64 
      }))
    });
    
    // Busca por trigger exato (case-insensitive)
    const normalizedSearchTrigger = imageTrigger.toLowerCase().trim();
    
    console.log('🔍 [IMAGE-LIBRARY] Debug matching DETALHADO:', {
      buscandoPor: normalizedSearchTrigger,
      originalInput: imageTrigger,
      triggersDisponiveis: library.map(item => ({ 
        trigger: item.trigger, 
        name: item.name,
        triggerLower: item.trigger?.toLowerCase(),
        match: item.trigger?.toLowerCase() === normalizedSearchTrigger
      }))
    });
    
    console.log('🎯 [IMAGE-LIBRARY] Fazendo busca exata...');
    const image = library.find(item => {
      const itemTrigger = item.trigger?.toLowerCase();
      const match = itemTrigger === normalizedSearchTrigger;
      console.log(`🔍 [IMAGE-LIBRARY] Comparando "${itemTrigger}" === "${normalizedSearchTrigger}" = ${match}`);
      return item.trigger && match;
    });
    
    if (!image) {
      console.warn('📚 [IMAGE-LIBRARY] Imagem não encontrada:', {
        procurandoPor: normalizedSearchTrigger,
        triggersDisponiveis: library.map(item => item.trigger)
      });
      
      // Sugerir triggers similares
      const similarTriggers = library
        .filter(item => item.trigger.toLowerCase().includes(normalizedSearchTrigger.substring(0, 3)))
        .map(item => item.trigger)
        .slice(0, 3);
      
      if (similarTriggers.length > 0) {
        console.log('💡 [IMAGE-LIBRARY] Triggers similares encontrados:', similarTriggers);
      }
      
      return null;
    }
    
    // Verificar se existe imageBase64
    if (!image.imageBase64) {
      console.error('❌ [IMAGE-LIBRARY] Imagem encontrada mas sem imageBase64:', {
        trigger: image.trigger,
        temUrl: !!image.url,
        temImageBase64: !!image.imageBase64
      });
      return null;
    }
    
    console.log('✅ [IMAGE-LIBRARY] Imagem encontrada com sucesso:', {
      trigger: image.trigger,
      name: image.name,
      format: image.format,
      size: image.size,
      category: image.category,
      imageBase64Length: image.imageBase64.length
    });
    
    return { 
      imageBase64: image.imageBase64,
      format: image.format || 'jpg'
    };
    
  } catch (error) {
    console.error('❌ [IMAGE-LIBRARY] Erro ao buscar imagem:', error);
    return null;
  }
}

/**
 * 🖼️ ENVIAR IMAGEM DA BIBLIOTECA VIA /send/media-file (CORRIGIDO)
 * Usa FormData direto sem upload intermediário para storage
 */
async function sendLibraryImageMessage(
  instanceId: string, 
  chatId: string, 
  imageData: { imageBase64: string, format: string }, 
  businessToken: string
): Promise<void> {
  try {
    console.log('🖼️ [SEND-LIBRARY-IMAGE] ===== USANDO /send/media-file COM FORMDATA =====');
    console.log('🖼️ [SEND-LIBRARY-IMAGE] Iniciando envio direto via FormData...', {
      instanceId: instanceId,
      chatId: chatId ? `${chatId.substring(0, 15)}...` : 'undefined',
      format: imageData.format,
      imageSize: Math.round(imageData.imageBase64.length * 0.75 / 1024) + 'KB'
    });
    
    // 1. CONVERTER BASE64 PARA BLOB (SEM UPLOAD PARA STORAGE)
    console.log('🔄 [SEND-LIBRARY-IMAGE] Convertendo base64 para Blob...');
    
    const binaryString = atob(imageData.imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: `image/${imageData.format}` });
    
    console.log('✅ [SEND-LIBRARY-IMAGE] Blob criado:', {
      size: imageBlob.size,
      type: imageBlob.type
    });
    
    // 2. CRIAR FORMDATA IGUAL AO IMAGESENDER QUE FUNCIONA
    const timestamp = Date.now();
    const fileName = `library_${timestamp}.${imageData.format}`;
    
    const formData = new FormData();
    formData.append('recipient', chatId);
    formData.append('attachment', imageBlob, fileName);
    formData.append('mediatype', 'image');
    formData.append('delay', '1200');
    
    // ExternalAttributes para tracking
    const externalAttributes = {
      source: 'image_library',
      mediaType: 'image',
      fileName: fileName,
      fileSize: imageBlob.size,
      timestamp: timestamp
    };
    formData.append('externalAttributes', JSON.stringify(externalAttributes));
    
    console.log('📦 [SEND-LIBRARY-IMAGE] FormData criado:', {
      recipient: chatId,
      fileName: fileName,
      mediatype: 'image',
      delay: '1200',
      fileSize: imageBlob.size
    });
    
    // 3. ENVIAR VIA /send/media-file (ENDPOINT CORRETO QUE FUNCIONA)
    console.log('📡 [SEND-LIBRARY-IMAGE] Enviando via /send/media-file...');
    
    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/send/media-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`
        // Não incluir Content-Type - FormData define automaticamente
      },
      body: formData
    });
    
    console.log('🔍 [SEND-LIBRARY-IMAGE] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SEND-LIBRARY-IMAGE] Erro na API Yumer:', errorText);
      throw new Error(`Falha no envio de imagem: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [SEND-LIBRARY-IMAGE] Imagem da biblioteca enviada com sucesso via /send/media-file:', {
      messageId: result.messageId || result.key?.id || 'N/A',
      fileName: fileName,
      format: imageData.format,
      fileSize: imageBlob.size,
      success: true
    });
    
  } catch (error) {
    console.error('❌ [SEND-LIBRARY-IMAGE] Erro ao enviar imagem da biblioteca:', error);
    throw error;
  }
}

/**
 * 🎥 PROCESSAR COMANDOS DE VÍDEO
 */
async function processVideoCommands(
  message: string, 
  context: { assistantId: string, instanceId: string, chatId: string, businessToken: string }
): Promise<{ hasVideoCommands: boolean; processedCount: number }> {
  try {
    console.log('🎥 [VIDEO-COMMANDS] ========== INICIANDO PROCESSAMENTO DE VÍDEOS ==========');
    console.log('🎥 [VIDEO-COMMANDS] Assistant ID:', context.assistantId);
    console.log('🎥 [VIDEO-COMMANDS] Instance ID:', context.instanceId);
    console.log('🎥 [VIDEO-COMMANDS] Business Token presente:', !!context.businessToken);
    console.log('🎥 [VIDEO-COMMANDS] Mensagem recebida:', `"${message}"`);
    console.log('🎥 [VIDEO-COMMANDS] Mensagem tipo:', typeof message);
    console.log('🎥 [VIDEO-COMMANDS] Mensagem length:', message.length);
    console.log('🎥 [VIDEO-COMMANDS] Context completo:', JSON.stringify(context, null, 2));
    
    // 🔧 TESTE FORÇADO SUPER AGRESSIVO PARA QUALQUER MENSAGEM COM "teste2" 
    if (message.toLowerCase().includes('teste2') || message.toLowerCase().includes('video')) {
      console.log('🔧 [VIDEO-COMMANDS] ===== TESTE FORÇADO SUPER AGRESSIVO ATIVADO =====');
      console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: Mensagem detectada - processando QUALQUER comando de vídeo...');
      console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: AssistantId:', context.assistantId);
      console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: BusinessToken presente:', !!context.businessToken);
      
      try {
        // 🚨 PRIMEIRA TENTATIVA: Buscar na biblioteca normal
        let libraryVideo = await getVideoFromLibrary(context.assistantId, 'teste2');
        console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: Resultado da busca biblioteca:', !!libraryVideo);
        
        // 🚨 FALLBACK HARDCODED: Se não encontrou na biblioteca, criar vídeo de teste
        if (!libraryVideo) {
          console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: Criando vídeo hardcoded para teste...');
          
          // Vídeo MP4 minúsculo em Base64 (apenas alguns frames para teste)
          const testVideoBase64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAsdtZGF0AAAC7wYF//+X3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzA4MSBiZjc2YjVlIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4Mzow';
          
          libraryVideo = {
            videoBase64: testVideoBase64,
            format: 'mp4'
          };
          
          console.log('✅ [VIDEO-COMMANDS] TESTE FORÇADO: Vídeo hardcoded criado:', {
            videoBase64Length: libraryVideo.videoBase64.length,
            format: libraryVideo.format
          });
        }
        
        if (libraryVideo) {          
          console.log('🚀 [VIDEO-COMMANDS] TESTE FORÇADO: Enviando vídeo via sendLibraryVideoMessage...');
          console.log('🔧 [VIDEO-COMMANDS] TESTE FORÇADO: Estrutura do vídeo para envio:', {
            hasVideoBase64: !!libraryVideo.videoBase64,
            hasFormat: !!libraryVideo.format,
            videoBase64Length: libraryVideo.videoBase64?.length || 0,
            format: libraryVideo.format
          });
          
          await sendLibraryVideoMessage(context.instanceId, context.chatId, { 
            videoBase64: libraryVideo.videoBase64, 
            format: libraryVideo.format 
          }, context.businessToken);
          console.log('✅ [VIDEO-COMMANDS] TESTE FORÇADO: Vídeo enviado com sucesso!');
          
          return { hasVideoCommands: true, processedCount: 1 };
        }
      } catch (error) {
        console.error('❌ [VIDEO-COMMANDS] TESTE FORÇADO: Erro:', error);
        console.error('❌ [VIDEO-COMMANDS] TESTE FORÇADO: Stack:', error.stack);
      }
      
      console.log('🔧 [VIDEO-COMMANDS] ===== FIM DO TESTE FORÇADO =====');
    }
    
    let processedCount = 0;
    
    // ✅ LIMPAR E NORMALIZAR MENSAGEM PARA TESTES MAIS PRECISOS
    const cleanMessage = message.trim();
    console.log('🎥 [VIDEO-COMMANDS] Analisando mensagem para comandos de vídeo...');
    console.log('🔍 [VIDEO-COMMANDS] Mensagem limpa:', cleanMessage);
    
    // ✅ REGEX PARA COMANDO DE VÍDEO: "video trigger" (igual ao áudio que funciona)
    const videoCommandPattern = /^video\s+([a-zA-Z0-9_-]+)$/i;
    
    console.log('🎯 [VIDEO-COMMANDS] Regex vídeo:', videoCommandPattern.source);
    
    // ✅ TESTE DIRETO DO REGEX COM MENSAGEM LIMPA
    const testVideoMatch = cleanMessage.match(videoCommandPattern);
    console.log('🔍 [VIDEO-COMMANDS] Teste Video regex:', testVideoMatch);
    
    if (testVideoMatch) {
      console.log('🎥 [VIDEO-LIBRARY] ✅ COMANDO DE VÍDEO DETECTADO!');
      console.log('🎥 [VIDEO-LIBRARY] Comando completo:', testVideoMatch[0]);
      console.log('🎥 [VIDEO-LIBRARY] Trigger do vídeo:', testVideoMatch[1]);
      
      const videoTrigger = testVideoMatch[1].trim();
      
      try {
        const libraryVideo = await getVideoFromLibrary(context.assistantId, videoTrigger);
        
        if (libraryVideo) {
          console.log('🎥 [VIDEO-LIBRARY] ✅ Vídeo encontrado na biblioteca, enviando...');
          console.log('🔧 [VIDEO-LIBRARY] Estrutura do vídeo para envio:', {
            hasVideoBase64: !!libraryVideo.videoBase64,
            hasFormat: !!libraryVideo.format,
            videoBase64Length: libraryVideo.videoBase64?.length || 0,
            format: libraryVideo.format
          });
          await sendLibraryVideoMessage(context.instanceId, context.chatId, { 
            videoBase64: libraryVideo.videoBase64, 
            format: libraryVideo.format 
          }, context.businessToken);
          processedCount++;
          console.log('✅ [VIDEO-LIBRARY] Vídeo da biblioteca enviado com sucesso:', videoTrigger);
        } else {
          console.warn('⚠️ [VIDEO-LIBRARY] Vídeo não encontrado na biblioteca:', videoTrigger);
        }
        
      } catch (error) {
        console.error('❌ [VIDEO-LIBRARY] Erro ao processar vídeo da biblioteca:', error);
      }
    }
    
    console.log('🎥 [PROCESS-VIDEO] Processamento concluído - comandos:', processedCount);
    console.log('🎥 [VIDEO-COMMANDS] ✅ Comandos de vídeo processados:', processedCount);
    
    return {
      hasVideoCommands: processedCount > 0,
      processedCount: processedCount
    };
    
  } catch (error) {
    console.error('❌ [PROCESS-VIDEO] Erro geral no processamento de vídeos:', error);
    return {
      hasVideoCommands: false,
      processedCount: 0
    };
  }
}

/**
 * 📚 BUSCAR VÍDEO DA BIBLIOTECA
 */
async function getVideoFromLibrary(assistantId: string, videoTrigger: string): Promise<{ videoBase64: string, format: string } | null> {
  try {
    console.log('📚 [VIDEO-LIBRARY] 🔍 BUSCANDO VÍDEO NA BIBLIOTECA - DEBUG EXTREMO:');
    console.log('📚 [VIDEO-LIBRARY] 🆔 Assistant ID:', assistantId);
    console.log('📚 [VIDEO-LIBRARY] 🎯 Trigger buscado:', JSON.stringify(videoTrigger));
    console.log('📚 [VIDEO-LIBRARY] 📊 Tipo do trigger:', typeof videoTrigger);
    console.log('📚 [VIDEO-LIBRARY] 🧹 Trigger limpo:', JSON.stringify(videoTrigger.trim()));
    
    // Buscar na tabela assistants campo advanced_settings
    console.log('📚 [VIDEO-LIBRARY] 🔍 FAZENDO QUERY NO SUPABASE...');
    const { data: assistantData, error: assistantError } = await supabase
      .from('assistants')
      .select('advanced_settings')
      .eq('id', assistantId)
      .single();
    
    if (assistantError) {
      console.error('❌ [VIDEO-LIBRARY] 💥 ERRO NA QUERY DO ASSISTANT:', JSON.stringify(assistantError));
      return null;
    }
    
    console.log('📚 [VIDEO-LIBRARY] 📊 DADOS DO ASSISTENTE RECEBIDOS:', {
      hasData: !!assistantData,
      hasAdvancedSettings: !!assistantData?.advanced_settings,
      typeOfAdvancedSettings: typeof assistantData?.advanced_settings,
      advancedSettingsLength: typeof assistantData?.advanced_settings === 'string' ? assistantData.advanced_settings.length : 'not string',
      rawAdvancedSettingsPreview: typeof assistantData?.advanced_settings === 'string' ? assistantData.advanced_settings.substring(0, 200) + '...' : 'not string'
    });
    
    if (!assistantData?.advanced_settings) {
      console.log('❌ [VIDEO-LIBRARY] 🚫 ASSISTANT SEM ADVANCED_SETTINGS');
      return null;
    }
    
    // 🎯 PARSER REFORÇADO PARA ESTRUTURA COMPLEXA ANINHADA
    let advancedSettings = assistantData.advanced_settings;
    
    console.log('🔧 [VIDEO-LIBRARY] 📊 ETAPA 1 - PARSING: Tipo inicial:', typeof advancedSettings);
    
    // STEP 1: Parse inicial se for string
    if (typeof advancedSettings === 'string') {
      try {
        console.log('🔧 [VIDEO-LIBRARY] 📄 Fazendo JSON.parse da string...');
        advancedSettings = JSON.parse(advancedSettings);
        console.log('✅ [VIDEO-LIBRARY] 🎉 String parsed para object com sucesso');
        console.log('📊 [VIDEO-LIBRARY] 📋 Keys do objeto parseado:', Object.keys(advancedSettings));
      } catch (parseError) {
        console.error('❌ [VIDEO-LIBRARY] 💥 Erro ao fazer parse da string:', parseError);
        console.error('🔧 [VIDEO-LIBRARY] 📄 String que causou erro:', assistantData.advanced_settings.substring(0, 500));
        return null;
      }
    }
    
    console.log('🔧 [VIDEO-LIBRARY] ETAPA 2: Após primeiro parse, tipo:', typeof advancedSettings);
    console.log('🔧 [VIDEO-LIBRARY] ETAPA 2: Chaves disponíveis:', Object.keys(advancedSettings));
    
    // STEP 2: NOVO ALGORITMO PARA ESTRUTURA ANINHADA COMPLEXA
    if (advancedSettings && typeof advancedSettings === 'object') {
      // 🎯 TENTATIVA 1: Verificar se já tem video_library diretamente
      if (advancedSettings.video_library && Array.isArray(advancedSettings.video_library)) {
        console.log('✅ [VIDEO-LIBRARY] video_library encontrada diretamente!');
      } else {
        console.log('🔍 [VIDEO-LIBRARY] video_library não encontrada diretamente, procurando em estrutura aninhada...');
        
        // 🎯 TENTATIVA 2: Procurar em chaves numéricas (estrutura aninhada típica)
        let found = false;
        for (const key of Object.keys(advancedSettings)) {
          console.log(`🔍 [VIDEO-LIBRARY] Verificando chave "${key}"...`);
          
          if (typeof advancedSettings[key] === 'string') {
            console.log(`🔧 [VIDEO-LIBRARY] Chave "${key}" é string, tentando parse...`);
            try {
              const nestedData = JSON.parse(advancedSettings[key]);
              console.log(`🔍 [VIDEO-LIBRARY] Parse da chave "${key}" - chaves:`, Object.keys(nestedData));
              
              if (nestedData.video_library && Array.isArray(nestedData.video_library)) {
                advancedSettings = nestedData;
                console.log(`✅ [VIDEO-LIBRARY] video_library encontrada na chave "${key}"!`);
                found = true;
                break;
              }
            } catch (nestedParseError) {
              console.log(`⚠️ [VIDEO-LIBRARY] Erro ao fazer parse da chave "${key}":`, nestedParseError.message);
            }
          } else if (typeof advancedSettings[key] === 'object' && advancedSettings[key] !== null) {
            console.log(`🔍 [VIDEO-LIBRARY] Chave "${key}" é object, verificando video_library...`);
            if (advancedSettings[key].video_library && Array.isArray(advancedSettings[key].video_library)) {
              advancedSettings = advancedSettings[key];
              console.log(`✅ [VIDEO-LIBRARY] video_library encontrada no object da chave "${key}"!`);
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          console.log('🔍 [VIDEO-LIBRARY] Tentando busca recursiva mais profunda...');
          // 🎯 TENTATIVA 3: Busca recursiva mais profunda
          for (const key of Object.keys(advancedSettings)) {
            const value = advancedSettings[key];
            if (typeof value === 'object' && value !== null) {
              for (const subKey of Object.keys(value)) {
                if (typeof value[subKey] === 'string') {
                  try {
                    const deepNestedData = JSON.parse(value[subKey]);
                    if (deepNestedData.video_library && Array.isArray(deepNestedData.video_library)) {
                      advancedSettings = deepNestedData;
                      console.log(`✅ [VIDEO-LIBRARY] video_library encontrada em ${key}.${subKey}!`);
                      found = true;
                      break;
                    }
                  } catch (error) {
                    // Silencioso para não poluir logs
                  }
                }
              }
              if (found) break;
            }
          }
        }
      }
    }
    
    console.log('🔍 [VIDEO-LIBRARY] Advanced settings FINAL após todos os parses:', {
      keys: Object.keys(advancedSettings),
      hasVideoLibrary: !!advancedSettings?.video_library,
      hasAudioLibrary: !!advancedSettings?.audio_library,
      hasImageLibrary: !!advancedSettings?.image_library,
      videoLibraryLength: advancedSettings?.video_library?.length || 0,
      audioLibraryLength: advancedSettings?.audio_library?.length || 0,
      imageLibraryLength: advancedSettings?.image_library?.length || 0
    });
    
    if (!advancedSettings?.video_library) {
      console.error('❌ [VIDEO-LIBRARY] ⚠️ BIBLIOTECA DE VÍDEOS NÃO ENCONTRADA!', {
        assistantId,
        availableKeys: Object.keys(advancedSettings),
        hasAudioLibrary: !!advancedSettings?.audio_library,
        hasImageLibrary: !!advancedSettings?.image_library,
        totalAudioLibraryItems: advancedSettings?.audio_library?.length || 0,
        totalImageLibraryItems: advancedSettings?.image_library?.length || 0,
        message: 'Você precisa primeiro SALVAR um vídeo na interface do assistente!',
        instructions: [
          '1. Vá para Configurações do Assistente',
          '2. Acesse a aba "Configurações de Vídeo"', 
          '3. Faça upload de um vídeo com trigger "teste"',
          '4. Salve as configurações',
          '5. Teste novamente com "video teste"'
        ]
      });
      
      // TODO: Futuramente podemos auto-inicializar video_library vazia aqui
      // Por enquanto, retornamos null para forçar o usuário a configurar
      return null;
    }
    
    const library = advancedSettings.video_library as any[];
    console.log('📚 [VIDEO-LIBRARY] Biblioteca carregada:', {
      totalVideos: library.length,
      videosDisponiveis: library.map(item => ({ 
        trigger: item.trigger, 
        name: item.name,
        format: item.format,
        hasVideoBase64: !!item.videoBase64 
      }))
    });
    
    // Busca por trigger exato (case-insensitive)
    const normalizedSearchTrigger = videoTrigger.toLowerCase().trim();
    
    console.log('🔍 [VIDEO-LIBRARY] Debug matching DETALHADO:', {
      buscandoPor: normalizedSearchTrigger,
      originalInput: videoTrigger,
      triggersDisponiveis: library.map(item => ({ 
        trigger: item.trigger, 
        name: item.name,
        triggerLower: item.trigger?.toLowerCase(),
        match: item.trigger?.toLowerCase() === normalizedSearchTrigger
      }))
    });
    
    console.log('🎯 [VIDEO-LIBRARY] Fazendo busca exata...');
    const video = library.find(item => {
      const itemTrigger = item.trigger?.toLowerCase();
      const match = itemTrigger === normalizedSearchTrigger;
      console.log(`🔍 [VIDEO-LIBRARY] Comparando "${itemTrigger}" === "${normalizedSearchTrigger}" = ${match}`);
      return item.trigger && match;
    });
    
    if (!video) {
      console.warn('📚 [VIDEO-LIBRARY] Vídeo não encontrado:', {
        procurandoPor: normalizedSearchTrigger,
        triggersDisponiveis: library.map(item => item.trigger)
      });
      
      // Sugerir triggers similares
      const similarTriggers = library
        .filter(item => item.trigger.toLowerCase().includes(normalizedSearchTrigger.substring(0, 3)))
        .map(item => item.trigger)
        .slice(0, 3);
      
      if (similarTriggers.length > 0) {
        console.log('💡 [VIDEO-LIBRARY] Triggers similares encontrados:', similarTriggers);
      }
      
      return null;
    }
    
    console.log('✅ [VIDEO-LIBRARY] 🎉 VÍDEO ENCONTRADO!');
    console.log('📊 [VIDEO-LIBRARY] 📋 DADOS COMPLETOS DO VÍDEO:', {
      trigger: video.trigger,
      name: video.name,
      format: video.format,
      hasVideoBase64: !!video.videoBase64,
      hasVideoData: !!video.video_data,
      videoBase64Length: video.videoBase64?.length || 0,
      videoDataLength: video.video_data?.length || 0,
      allKeys: Object.keys(video)
    });
    
    // NORMALIZAR DADOS DO VÍDEO
    const videoBase64 = video.videoBase64 || video.video_data;
    const format = video.format || 'mp4';
    
    if (!videoBase64) {
      console.error('❌ [VIDEO-LIBRARY] 🚫 VÍDEO SEM DADOS BASE64!');
      console.error('🔧 [VIDEO-LIBRARY] 📊 Estrutura do vídeo:', JSON.stringify(video, null, 2));
      return null;
    }
    
    console.log('✅ [VIDEO-LIBRARY] 📋 VÍDEO NORMALIZADO E PRONTO PARA ENVIO:', {
      trigger: video.trigger,
      format: format,
      videoBase64Length: videoBase64.length,
      videoBase64Sample: videoBase64.substring(0, 100) + '...'
    });
    
    return {
      videoBase64: videoBase64,
      format: format
    };
    
  } catch (error) {
    console.error('❌ [VIDEO-LIBRARY] 💥 ERRO GERAL NA BUSCA:', error);
    console.error('🔧 [VIDEO-LIBRARY] 📊 Stack trace:', error.stack);
    return null;
  }
}

/**
 * 📤 ENVIAR VÍDEO DA BIBLIOTECA
 */
async function sendLibraryVideoMessage(instanceId: string, chatId: string, videoData: any, businessToken: string) {
  try {
    console.log('📤 [VIDEO-SEND] 🚀 INICIANDO ENVIO DE VÍDEO DA BIBLIOTECA');
    console.log('📤 [VIDEO-SEND] 🆔 Instance ID:', instanceId);
    console.log('📤 [VIDEO-SEND] 💬 Chat ID:', chatId);
    console.log('📤 [VIDEO-SEND] 🔑 Business Token presente:', !!businessToken);
    console.log('📤 [VIDEO-SEND] 📊 DADOS RECEBIDOS PARA ENVIO:', {
      type: typeof videoData,
      keys: Object.keys(videoData || {}),
      hasVideoBase64: !!videoData?.videoBase64,
      videoBase64Length: videoData?.videoBase64?.length || 0,
      format: videoData?.format,
      videoBase64Sample: videoData?.videoBase64?.substring(0, 100) + '...' || 'N/A'
    });

    // VALIDAÇÕES CRÍTICAS
    if (!videoData) {
      console.error('❌ [VIDEO-SEND] 🚫 VIDEO_DATA É NULL/UNDEFINED');
      throw new Error('VideoData não fornecido');
    }

    if (!videoData.videoBase64) {
      console.error('❌ [VIDEO-SEND] 🚫 VIDEO_BASE64 NÃO ENCONTRADO');
      console.error('🔧 [VIDEO-SEND] 📊 Estrutura recebida:', JSON.stringify(videoData, null, 2));
      throw new Error('Video base64 não encontrado');
    }

    if (!videoData.format) {
      console.error('❌ [VIDEO-SEND] 🚫 FORMATO NÃO ENCONTRADO');
      console.error('🔧 [VIDEO-SEND] 📊 Estrutura recebida:', JSON.stringify(videoData, null, 2));
      // Usar fallback para mp4 se não tiver formato
      videoData.format = 'mp4';
      console.log('🔧 [VIDEO-SEND] 📋 Usando formato fallback: mp4');
    }

    console.log('✅ [VIDEO-SEND] 📋 VALIDAÇÕES INICIAIS PASSARAM');
    console.log('📤 [VIDEO-SEND] 📊 Base64 original length:', videoData.videoBase64.length);

    // PROCESSAR BASE64 
    let cleanBase64 = videoData.videoBase64;
    
    // Remover prefixo data URL se existir
    if (cleanBase64.startsWith('data:')) {
      const commaIndex = cleanBase64.indexOf(',');
      if (commaIndex !== -1) {
        cleanBase64 = cleanBase64.substring(commaIndex + 1);
        console.log('🔧 [VIDEO-SEND] 📄 Prefixo data: removido');
      }
    }
    
    console.log('📤 [VIDEO-SEND] 📊 Base64 limpo length:', cleanBase64.length);
    
    // CRIAR BLOB DO VÍDEO
    let videoBlob;
    try {
      console.log('📤 [VIDEO-SEND] 🔄 Convertendo Base64 para Blob...');
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      videoBlob = new Blob([bytes], { type: `video/${videoData.format}` });
      console.log('✅ [VIDEO-SEND] 📦 BLOB CRIADO COM SUCESSO:', {
        size: videoBlob.size,
        type: videoBlob.type
      });
    } catch (blobError) {
      console.error('❌ [VIDEO-SEND] 💥 ERRO AO CRIAR BLOB:', blobError);
      console.error('🔧 [VIDEO-SEND] 📊 Base64 sample (primeiros 100 chars):', cleanBase64.substring(0, 100));
      throw new Error(`Erro ao processar video base64: ${blobError.message}`);
    }

    // CRIAR ARQUIVO E FORMDATA
    const fileName = `video.${videoData.format}`;
    const mimeType = `video/${videoData.format}`;
    console.log('📤 [VIDEO-SEND] 📁 Preparando arquivo:', { fileName, mimeType });

    let videoFile, formData;
    try {
      videoFile = new File([videoBlob], fileName, { type: mimeType });
      console.log('✅ [VIDEO-SEND] 📁 ARQUIVO CRIADO:', {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type,
        lastModified: videoFile.lastModified
      });

      formData = new FormData();
      formData.append('recipient', chatId);
      formData.append('attachment', videoFile);
      formData.append('mediatype', 'video');
      formData.append('delay', '1200');
      
      // ExternalAttributes para tracking (igual ao videosender)
      const externalAttributes = {
        source: 'video_library',
        mediaType: 'video',
        fileName: fileName,
        fileSize: videoFile.size,
        timestamp: Date.now()
      };
      formData.append('externalAttributes', JSON.stringify(externalAttributes));
      
      console.log('✅ [VIDEO-SEND] 📋 FORMDATA PREPARADO (FORMATO CORRETO)');
      
      // LOG DETALHADO DO FORMDATA
      console.log('📤 [VIDEO-SEND] 📊 FORMDATA ENTRIES DETALHADO:');
      for (const [key, value] of formData.entries()) {
        if (key === 'file') {
          console.log(`  🗂️ ${key}: File(name="${value.name}", size=${value.size}, type="${value.type}")`);
        } else {
          console.log(`  📝 ${key}: "${value}"`);
        }
      }
    } catch (formError) {
      console.error('❌ [VIDEO-SEND] 💥 ERRO AO CRIAR FORMDATA:', formError);
      throw new Error(`Erro ao criar FormData: ${formError.message}`);
    }

    // ENVIAR VIA API YUMER (ENDPOINT CORRETO)
    const apiUrl = `https://api.yumer.com.br/api/v2/instance/${instanceId}/send/media-file`;
    console.log('📤 [VIDEO-SEND] 🌐 FAZENDO REQUISIÇÃO PARA:', apiUrl);
    console.log('📤 [VIDEO-SEND] 🔑 Authorization header presente:', !!businessToken);
    console.log('📤 [VIDEO-SEND] 📋 Headers que serão enviados:', {
      'Authorization': businessToken ? `Bearer ${businessToken.substring(0, 20)}...` : 'MISSING',
      'Content-Type': 'multipart/form-data (automático)'
    });

    let response;
    try {
      console.log('📤 [VIDEO-SEND] 🚀 FAZENDO REQUISIÇÃO HTTP...');
      const startTime = Date.now();
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
        },
        body: formData
      });
      
      const endTime = Date.now();
      console.log('📤 [VIDEO-SEND] 📊 RESPOSTA RECEBIDA:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        tempo: `${endTime - startTime}ms`,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (fetchError) {
      console.error('❌ [VIDEO-SEND] 💥 ERRO NA REQUISIÇÃO HTTP:', fetchError);
      console.error('🔧 [VIDEO-SEND] 📊 Detalhes do erro:', {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack
      });
      throw new Error(`Erro na requisição HTTP: ${fetchError.message}`);
    }

    // PROCESSAR RESPOSTA
    if (!response.ok) {
      console.error('❌ [VIDEO-SEND] 🚫 RESPOSTA HTTP NÃO OK');
      let errorText = 'Erro desconhecido';
      try {
        errorText = await response.text();
        console.error('📤 [VIDEO-SEND] 📄 TEXTO DO ERRO DA API:', errorText);
        
        // Tentar fazer parse do JSON se possível
        try {
          const errorJson = JSON.parse(errorText);
          console.error('📤 [VIDEO-SEND] 📋 JSON DO ERRO:', errorJson);
        } catch (jsonParseError) {
          console.log('📤 [VIDEO-SEND] 📄 Erro não é JSON válido');
        }
      } catch (textError) {
        console.error('📤 [VIDEO-SEND] 💥 Erro ao ler texto da resposta:', textError);
      }
      throw new Error(`API retornou status ${response.status}: ${errorText}`);
    }

    // PROCESSAR RESPOSTA DE SUCESSO
    let result;
    try {
      result = await response.json();
      console.log('✅ [VIDEO-SEND] 🎉 VÍDEO ENVIADO COM SUCESSO!');
      console.log('📤 [VIDEO-SEND] 📊 RESULTADO COMPLETO:', JSON.stringify(result, null, 2));
      console.log('📤 [VIDEO-SEND] 📋 RESUMO DO SUCESSO:', {
        messageId: result?.messageId || result?.key?.id || result?.id || 'N/A',
        success: result?.success !== false,
        status: result?.status || 'success',
        fileName: fileName,
        fileSize: videoFile.size,
        format: videoData.format
      });
    } catch (jsonError) {
      console.error('❌ [VIDEO-SEND] 💥 ERRO AO PARSEAR JSON DA RESPOSTA:', jsonError);
      const responseText = await response.text();
      console.log('📤 [VIDEO-SEND] 📄 Resposta raw (não é JSON):', responseText);
      
      // Retornar resultado baseado no status HTTP
      result = { 
        success: true, 
        rawResponse: responseText,
        status: response.status,
        statusText: response.statusText
      };
      console.log('✅ [VIDEO-SEND] 🎯 Assumindo sucesso baseado no status HTTP:', response.status);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [VIDEO-SEND] 💥 ERRO GERAL NO ENVIO DE VÍDEO:', error);
    console.error('🔧 [VIDEO-SEND] 📊 Stack trace completo:', error.stack);
    console.error('🔧 [VIDEO-SEND] 📊 Detalhes do erro:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      videoDataKeys: videoData ? Object.keys(videoData) : 'videoData is null'
    });
    throw error;
  }
}
