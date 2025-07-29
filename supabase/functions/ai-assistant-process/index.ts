
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

    // 🔑 PRIORIZAÇÃO DE API KEYS: Cliente específico > Global
    let openAIApiKey = globalOpenAIApiKey;
    let keySource = 'global';

    // Buscar em paralelo: config do cliente, memória conversacional e histórico
    const [clientConfigResult, memoryResult, messagesResult] = await Promise.allSettled([
      // Buscar API Key específica do cliente
      supabase
        .from('client_ai_configs')
        .select('openai_api_key, default_model')
        .eq('client_id', resolvedClientId)
        .single(),
      
      // Buscar memória conversacional
      supabase
        .from('conversation_context')
        .select('*')
        .eq('client_id', resolvedClientId)
        .eq('chat_id', resolvedContext.chatId)
        .eq('instance_id', resolvedInstanceId)
        .single(),
      
      // Buscar histórico de mensagens
      supabase
        .from('ticket_messages')
        .select('content, from_me, sender_name, timestamp, message_id')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: false })
        .limit(50)
    ]);

    // Processar API Key do cliente
    if (clientConfigResult.status === 'fulfilled' && clientConfigResult.value.data?.openai_api_key) {
      openAIApiKey = clientConfigResult.value.data.openai_api_key;
      keySource = 'client';
      console.log('🔑 [AI-ASSISTANT] Usando API Key específica do cliente');
    } else {
      console.log('🔑 [AI-ASSISTANT] Cliente não tem API Key própria, usando global');
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

    console.log('🤖 [AI-ASSISTANT] Chamando OpenAI API com modelo:', safeAssistant.model || 'gpt-4o-mini');

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

    console.log('✅ [AI-ASSISTANT] Resposta da IA gerada:', {
      responseLength: aiResponse?.length || 0,
      model: safeAssistant.model || 'gpt-4o-mini'
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

    // Garantir business token válido
    console.log('🔐 [AI-ASSISTANT] Verificando business token para cliente:', resolvedClientId);
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('business_token')
      .eq('id', resolvedClientId)
      .single();
    
    if (clientError || !client?.business_token) {
      console.warn('⚠️ [AI-ASSISTANT] Business token não encontrado para cliente:', resolvedClientId);
    }

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

    // 📱 DEFINIR PRESENÇA COMO "DIGITANDO" ANTES DE RESPONDER
    try {
      console.log('📱 [PRESENCE] Definindo presença como "digitando" para IA');
      
      await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/chat/presence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          remoteJid: resolvedContext.chatId,
          status: 'composing'
        })
      });
      
      console.log('✅ [PRESENCE] Presença "digitando" definida com sucesso');
    } catch (presenceError) {
      console.warn('⚠️ [PRESENCE] Erro ao definir presença como digitando:', presenceError);
    }

    // Enviar usando yumerApiV2 com o ID correto
    const sendOptions = {
      delay: 1200,
      presence: 'composing',
      externalAttributes: `source=ai-assistant;ticketId=${ticketId};assistantId=${safeAssistant.id};timestamp=${Date.now()}`
    };

    let sendResult;
    try {
      // USAR IMPLEMENTAÇÃO DIRETA PARA EVITAR PROBLEMAS DE IMPORTAÇÃO
      console.log('📤 [AI-ASSISTANT] Enviando via API Yumer v2 diretamente...');
      
      const sendData = {
        recipient: resolvedContext.chatId,
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
        chatId: resolvedContext.chatId,
        messageId: sendResult.messageId
      });

      // 📱 VOLTAR PRESENÇA PARA "DISPONÍVEL" APÓS ENVIO
      try {
        console.log('📱 [PRESENCE] Definindo presença como "disponível" após envio');
        
        await fetch(`https://api.yumer.com.br/api/v2/instance/${realInstanceId}/chat/presence`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${client.business_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            remoteJid: resolvedContext.chatId,
            status: 'available'
          })
        });
        
        console.log('✅ [PRESENCE] Presença "disponível" definida com sucesso');
      } catch (presenceError) {
        console.warn('⚠️ [PRESENCE] Erro ao definir presença como disponível:', presenceError);
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
      aiResponse,
      conversationMemory
    );

    console.log('🎉 [AI-ASSISTANT] SUCESSO TOTAL! Assistente processou e enviou resposta:', {
      ticketId: ticketId,
      assistantName: safeAssistant?.name,
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
