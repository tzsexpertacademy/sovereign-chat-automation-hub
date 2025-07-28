import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-businessId, x-instanceId',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400'
};

// Interface para mensagens YUMER
interface YumerWebhookData {
  event?: string;
  instance?: {
    id?: number;
    instanceId?: string;
    name?: string;
    connectionStatus?: string;
  };
  data?: any;
}

// Interface para o sistema de batching
interface MessageBatch {
  chatId: string;
  instanceId: string;
  clientId: string;
  messages: any[];
  timeoutId?: number;
  firstMessageTime: number;
}

// ✅ SISTEMA DE BATCH SIMPLES - JANELA DE 4 SEGUNDOS
const messageBatches = new Map<string, MessageBatch>();

// ⚡ CONFIGURAÇÃO SIMPLES
const BATCH_TIMEOUT = 4000; // 4 segundos fixos

serve(async (req) => {
  console.log('🌐 [YUMER-UNIFIED-WEBHOOK] Recebendo requisição:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (for webhook testing)
  if (req.method === 'GET') {
    const origin = req.headers.get('origin') || 'unknown';
    console.log('✅ [YUMER-UNIFIED-WEBHOOK] GET request - Origin:', origin);
    
    return new Response(
      JSON.stringify({
        status: 'active',
        message: 'YUMER Unified Webhook Endpoint',
        timestamp: new Date().toISOString(),
        method: 'GET',
        endpoints: {
          webhook: '/webhook',
          test: '/webhook?test=true'
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Handle POST requests (actual webhooks)
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('📨 [YUMER-UNIFIED-WEBHOOK] POST recebido - Body length:', body.length);
      
      // Melhor tratamento para body vazio
      if (!body || body.trim() === '') {
        console.warn('⚠️ [YUMER-UNIFIED-WEBHOOK] Body vazio recebido - retornando sucesso');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Empty body received but processed',
            timestamp: new Date().toISOString()
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      let webhookData: YumerWebhookData;
      
      try {
        webhookData = JSON.parse(body);
      } catch (parseError) {
        console.error('❌ [YUMER-UNIFIED-WEBHOOK] Erro ao fazer parse do JSON:', parseError);
        console.error('❌ [YUMER-UNIFIED-WEBHOOK] Body que causou erro:', body.substring(0, 500));
        
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON format',
            timestamp: new Date().toISOString()
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('📋 [YUMER-UNIFIED-WEBHOOK] Dados YUMER recebidos:', JSON.stringify(webhookData, null, 2));

      // DETECTAR MENSAGENS YUMER pelo evento e estrutura
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.instanceId) {
        console.log('🎯 [YUMER-UNIFIED-WEBHOOK] Detectada mensagem YUMER - adicionando ao batch...');
        return await addToBatch(webhookData);
      }

      // Log outros eventos para debug
      if (webhookData.event) {
        console.log(`📋 [YUMER-UNIFIED-WEBHOOK] Evento não processado: ${webhookData.event}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook received but not a message event',
          event: webhookData.event || 'unknown',
          timestamp: new Date().toISOString()
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('❌ [YUMER-UNIFIED-WEBHOOK] Erro crítico:', error);
      
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Method not allowed
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});

// Função para adicionar mensagem ao batch
async function addToBatch(yumerData: YumerWebhookData) {
  try {
    const instanceId = yumerData.instance?.instanceId;
    const instanceName = yumerData.instance?.name;
    const messageData = yumerData.data;

    if (!instanceId || !messageData) {
      console.error('❌ [BATCH] Dados insuficientes para batching');
      return new Response(
        JSON.stringify({ error: 'Insufficient data for batching' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🎯 EXTRAIR DADOS DA MENSAGEM PRIMEIRO
    const messageId = messageData?.keyId || messageData?.messageId;
    const currentTime = Date.now();

    // Buscar instância para obter client_id
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, client_id, id, auth_token, yumer_instance_name')
      .eq('yumer_instance_name', instanceName)
      .single();

    if (instanceError || !instance) {
      console.log('🔍 [BATCH] Instância não encontrada, processando imediatamente');
      return await processYumerMessage(yumerData);
    }

    // Extrair dados da mensagem para determinar chatId
    const processedMessage = extractYumerMessageData(messageData, instance);
    if (!processedMessage || !processedMessage.chatId) {
      console.log('⚠️ [BATCH] Não foi possível extrair chatId, processando imediatamente');
      return await processYumerMessage(yumerData);
    }

    // Verificar se é mensagem do próprio sistema (fromMe = true)
    if (processedMessage.fromMe) {
      console.log('📤 [BATCH] Mensagem enviada pelo sistema - processando imediatamente');
      return await processYumerMessage(yumerData);
    }

    const batchKey = processedMessage.chatId; // Usar apenas chatId como chave

    console.log(`📦 [BATCH] Adicionando mensagem ao batch: ${batchKey}`);

    // Verificar se já existe um batch para este chat
    let batch = messageBatches.get(batchKey);
    
    if (!batch) {
      // Criar novo batch
      batch = {
        chatId: processedMessage.chatId,
        instanceId: instance.instance_id,
        clientId: instance.client_id,
        messages: [],
        firstMessageTime: currentTime
      };
      messageBatches.set(batchKey, batch);
      console.log(`🆕 [BATCH] Novo batch criado: ${batchKey}`);
      
      // ⏰ JANELA DE 4 SEGUNDOS - TIMEOUT FIXO
      setTimeout(async () => {
        console.log(`⏰ [JANELA-4S] Processando batch ${batchKey} após ${BATCH_TIMEOUT}ms`);
        await processBatch(batchKey);
      }, BATCH_TIMEOUT);
      
      console.log(`⏰ [JANELA-4S] Timer de 4 segundos iniciado para ${batchKey}`);
    }

    // Adicionar mensagem ao batch
    batch.messages.push(yumerData);
    console.log(`📥 [BATCH] Mensagem adicionada. Total no batch: ${batch.messages.length}`);

    // Resposta de sucesso para o webhook
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message added to batch',
        batchKey: batchKey,
        batchSize: batch.messages.length,
        timeoutRemaining: BATCH_TIMEOUT
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [BATCH] Erro ao adicionar ao batch:', error);
    return new Response(
      JSON.stringify({ error: 'Batch processing error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Função para processar batch de mensagens
async function processBatch(batchKey: string) {
  const batch = messageBatches.get(batchKey);
  if (!batch) {
    console.log(`⚠️ [BATCH] Batch não encontrado: ${batchKey}`);
    return;
  }

  console.log(`🚀 [BATCH] Processando batch ${batchKey} com ${batch.messages.length} mensagens`);
  console.log(`🕐 [BATCH] Tempo desde primeira mensagem: ${Date.now() - batch.firstMessageTime}ms`);

  try {
    // 🚫 MARCAR MENSAGENS COMO PROCESSADAS IMEDIATAMENTE
    console.log(`🏷️ [BATCH] Marcando ${batch.messages.length} mensagens como processadas...`);
    
    // 🎯 PROCESSAR BATCH COMO CONTEXTO ÚNICO - SEM PROCESSAR MENSAGENS INDIVIDUALMENTE
    let lastTicketId = null;
    let instanceDetails = null;
    let allMessageContents = [];
    
    // ⚡ PROCESSAR APENAS A ÚLTIMA MENSAGEM PARA CRIAR O TICKET
    const lastMessage = batch.messages[batch.messages.length - 1];
    instanceDetails = lastMessage.instance;
    
    console.log(`📝 [BATCH-UNIFIED] Processando APENAS a última mensagem para criar ticket e contexto`);
    
    try {
      // Processar apenas a última mensagem para criar/atualizar o ticket
      const result = await processYumerMessage(lastMessage, false); // false = não processar com IA ainda
      if (result?.ticketId) {
        lastTicketId = result.ticketId;
        console.log(`✅ [BATCH-UNIFIED] Ticket ID obtido: ${lastTicketId}`);
      }
      
      // 📝 EXTRAIR CONTEXTO DE TODAS AS MENSAGENS DO BATCH
      for (const yumerData of batch.messages) {
        try {
          const messageData = extractYumerMessageData(yumerData.data, {
            instance_id: batch.instanceId,
            client_id: batch.clientId
          });
          if (messageData && messageData.content) {
            allMessageContents.push(messageData.content);
          }
        } catch (extractError) {
          console.error('⚠️ [BATCH-UNIFIED] Erro ao extrair mensagem:', extractError);
        }
      }
      
      console.log(`📊 [BATCH-UNIFIED] Contexto extraído de ${allMessageContents.length} mensagens`);
      
    } catch (error) {
      console.error('❌ [BATCH-UNIFIED] Erro ao processar última mensagem:', error);
      return;
    }

    // 🤖 PROCESSAR COM IA - VERSÃO SIMPLIFICADA
    if (lastTicketId && allMessageContents.length > 0) {
      console.log(`🤖 [BATCH-SIMPLE] Iniciando processamento para ticket: ${lastTicketId}`);
      
      // Buscar dados da última mensagem
      const lastMessageData = extractYumerMessageData(lastMessage.data, {
        instance_id: batch.instanceId,
        client_id: batch.clientId
      });
      
      if (!lastMessageData) {
        console.error('❌ [BATCH-SIMPLE] Falha ao extrair dados da última mensagem');
        return;
      }
      
      // Verificação SUPER SIMPLES - apenas não processar se for mensagem própria
      if (lastMessageData.fromMe) {
        console.log('⚠️ [BATCH-SIMPLE] Mensagem é própria, não processando');
        return;
      }
      
      const fullContext = allMessageContents.join(' ');
      console.log(`📋 [BATCH-SIMPLE] Contexto: "${fullContext}"`);
      console.log(`🚀 [BATCH-SIMPLE] Chamando IA DIRETAMENTE (sem verificações complexas)`);
      
      try {
        const aiResult = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            ticketId: lastTicketId,
            message: fullContext,
            messageData: lastMessageData,
            messages: allMessageContents.map((content, index) => ({
              content: content,
              timestamp: new Date().toISOString(),
              from_me: false
            })),
            context: {
              chatId: lastMessageData.chatId,
              customerName: lastMessageData.contactName || 'Cliente',
              phoneNumber: lastMessageData.phoneNumber || 'N/A',
              batchInfo: `Batch de ${batch.messages.length} mensagens`
            }
          }
        });
        
        console.log('🎯 [BATCH-SIMPLE] Resultado IA:', {
          success: !!aiResult.data,
          error: !!aiResult.error,
          errorDetails: aiResult.error
        });
        
        if (aiResult.error) {
          console.error('❌ [BATCH-SIMPLE] Erro na IA - tentando fallback:', aiResult.error);
          
          // Fallback SUPER simples
          const fallbackResult = await supabase.functions.invoke('ai-assistant-process', {
            body: {
              ticketId: lastTicketId,
              message: lastMessageData.content || 'Mensagem sem conteúdo',
              messageData: lastMessageData
            }
          });
          
          console.log('🔄 [BATCH-SIMPLE] Resultado fallback:', {
            success: !!fallbackResult.data,
            error: !!fallbackResult.error
          });
        } else {
          console.log('✅ [BATCH-SIMPLE] IA respondeu com sucesso');
        }
      } catch (error) {
        console.error('❌ [BATCH-SIMPLE] Erro crítico ao chamar IA:', error);
      }
    } else {
      console.log(`⚠️ [BATCH-SIMPLE] Condições não atendidas: ticketId=${!!lastTicketId}, messages=${allMessageContents.length}`);
    }

    console.log(`✅ [BATCH] Batch processado com sucesso: ${batchKey}`);

  } catch (error) {
    console.error(`❌ [BATCH] ERRO CRÍTICO ao processar batch ${batchKey}:`, error);
    
    // 🛡️ FALLBACK CRÍTICO: Marcar mensagens como processadas mesmo com erro
    console.log('🔄 [FALLBACK-CRÍTICO] Marcando mensagens como processadas para evitar loop');
    try {
      for (const yumerData of batch.messages) {
        if (yumerData.data?.messageId) {
          await supabase
            .from('whatsapp_messages')
            .update({ is_processed: true, processing_started_at: new Date().toISOString() })
            .eq('message_id', yumerData.data.messageId);
        }
      }
      console.log('✅ [FALLBACK-CRÍTICO] Mensagens marcadas como processadas');
    } catch (fallbackError) {
      console.error('❌ [FALLBACK-CRÍTICO] Falha ao marcar mensagens:', fallbackError);
    }
  } finally {
    // 🧹 LIMPAR MEMÓRIA
    messageBatches.delete(batchKey);
    console.log(`🧹 [CLEANUP] Batch removido da memória: ${batchKey}`);
  }
}

// Função para processar mensagens YUMER
async function processYumerMessage(yumerData: YumerWebhookData, processAI: boolean = true) {
  console.log('🔧 [YUMER-PROCESS] Iniciando processamento de mensagem YUMER');
  
  try {
    const instanceId = yumerData.instance?.instanceId;
    const instanceName = yumerData.instance?.name;
    const messageData = yumerData.data;

    if (!instanceId || !messageData || !instanceName) {
      console.error('❌ [YUMER-PROCESS] Dados insuficientes:', { 
        instanceId, 
        instanceName,
        hasMessageData: !!messageData 
      });
      return new Response(
        JSON.stringify({ error: 'Insufficient data' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [YUMER-PROCESS] Buscando instância:', {
      instanceId: instanceId,
      instanceName: instanceName
    });

    // Buscar instância pelo nome da instância YUMER
    let { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, client_id, id, auth_token, yumer_instance_name')
      .eq('yumer_instance_name', instanceName)
      .single();

    // Se não encontrou, tentar buscar pelo custom_name
    if (instanceError || !instance) {
      console.log('🔍 [YUMER-PROCESS] Tentativa 2: Buscar por custom_name');
      
      const { data: instanceByCustomName, error: instanceByCustomNameError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, id, auth_token, yumer_instance_name')
        .eq('custom_name', instanceName)
        .single();
      
      if (!instanceByCustomNameError && instanceByCustomName) {
        instance = instanceByCustomName;
        instanceError = null;
      }
    }

    // Se não encontrou, tentar buscar pelo instance_id que pode conter o nome
    if (instanceError || !instance) {
      console.log('🔍 [YUMER-PROCESS] Tentativa 3: Buscar por instance_id que contém o nome');
      
      const { data: instanceById, error: instanceByIdError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, id, auth_token, yumer_instance_name')
        .eq('instance_id', instanceName)
        .single();
      
      if (!instanceByIdError && instanceById) {
        instance = instanceById;
        instanceError = null;
      }
    }

    // Se ainda não encontrou, tentar buscar por pattern no instance_id
    if (instanceError || !instance) {
      console.log('🔍 [YUMER-PROCESS] Tentativa 4: Buscar por pattern no instance_id');
      
      const { data: instanceByPattern, error: instanceByPatternError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, id, auth_token, yumer_instance_name')
        .ilike('instance_id', `%${instanceName}%`)
        .single();
      
      if (!instanceByPatternError && instanceByPattern) {
        instance = instanceByPattern;
        instanceError = null;
      }
    }

    if (instanceError || !instance) {
      console.error('❌ [YUMER-PROCESS] Instância não encontrada após todas as tentativas:', {
        instanceName,
        instanceId,
        error: instanceError
      });

      return new Response(
        JSON.stringify({ 
          error: 'Instance not found', 
          instanceName,
          instanceId
        }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [YUMER-PROCESS] Instância encontrada: ${instance.instance_id} (Cliente: ${instance.client_id})`);

    // Atualizar o yumer_instance_name se ainda não estiver definido
    if (!instance.yumer_instance_name) {
      console.log('🔄 [YUMER-PROCESS] Atualizando yumer_instance_name na instância');
      await supabase
        .from('whatsapp_instances')
        .update({ yumer_instance_name: instanceName })
        .eq('id', instance.id);
    }

    // 2. Extrair e normalizar dados da mensagem
    console.log('🔍 [YUMER-PROCESS] Dados brutos da mensagem YUMER:', JSON.stringify(messageData, null, 2));
    const processedMessage = extractYumerMessageData(messageData, instance);
    
    if (!processedMessage) {
      console.warn('⚠️ [YUMER-PROCESS] Dados da mensagem não puderam ser extraídos');
      return new Response(
        JSON.stringify({ error: 'Message data could not be extracted' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 [YUMER-PROCESS] Dados da mensagem extraídos:', JSON.stringify(processedMessage, null, 2));

    // Verificar se os dados essenciais estão presentes
    if (!processedMessage.messageId || !processedMessage.chatId) {
      console.error('❌ [YUMER-PROCESS] Dados essenciais da mensagem ausentes:', {
        messageId: !!processedMessage.messageId,
        chatId: !!processedMessage.chatId,
        content: !!processedMessage.content
      });
      return new Response(
        JSON.stringify({ error: 'Dados essenciais da mensagem ausentes' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Salvar mensagem bruta no whatsapp_messages
    console.log('💾 [YUMER-PROCESS] Iniciando salvamento da mensagem...');
    
    // 🔥 CORREÇÃO: Verificar se vai processar com IA antes de salvar
    const willProcessWithAI = !processedMessage.fromMe && processAI;
    
    try {
      await saveYumerMessage(processedMessage, instance.instance_id, willProcessWithAI);
      console.log('✅ [YUMER-PROCESS] Mensagem salva no whatsapp_messages com sucesso');
    } catch (saveError) {
      console.error('❌ [YUMER-PROCESS] Erro ao salvar mensagem:', saveError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar mensagem', details: saveError.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. Processar mensagem para tickets
    const ticketId = await processMessageToTickets(processedMessage, instance.client_id, instance.instance_id);
    
    // 🤖 5. ATIVAÇÃO AUTOMÁTICA DA IA: HABILITADO COM FALLBACK
    // CORREÇÃO: Reabilitar processamento individual como FALLBACK se batch falhar
    if (!processedMessage.fromMe && processAI) {
      console.log('🤖 [AI-TRIGGER] Verificando processamento (Batch preferido, Individual como fallback)');
      
      try {
        // Garantir que a instância está conectada a uma fila
        await ensureInstanceQueueConnection(instance.id, instance.client_id);
        console.log('✅ [AI-TRIGGER] Instância conectada à fila');
        
        // 🛡️ FALLBACK IMEDIATO: Se não há batch ativo, processar imediatamente
        const batchKey = `${instance.instance_id}-${processedMessage.chatId}`;
        const hasBatch = messageBatches.has(batchKey);
        
        if (!hasBatch) {
          console.log('🔄 [AI-FALLBACK] Nenhum batch ativo, processando imediatamente');
          
          const aiResult = await processWithAIIfEnabled(
            processedMessage,
            instance,
            false, // isBatch = false
            1, // batchSize = 1
            ticketId,
            undefined
          );
          console.log('✅ [AI-FALLBACK] Processamento individual executado:', aiResult ? 'sucesso' : 'sem resposta');
        } else {
          console.log('✅ [AI-TRIGGER] Mensagem será processada via BATCH ativo');
        }
      } catch (aiError) {
        console.error('❌ [AI-TRIGGER] Erro ao processar com IA:', aiError);
      }
    }
    
    console.log('✅ [YUMER-PROCESS] Mensagem YUMER processada com sucesso');
    
    // Retornar dados para processamento em batch se necessário
    if (!processAI) {
      return {
        success: true,
        ticketId: ticketId,
        processedMessage: processedMessage,
        instanceName: instance.instance_id,
        messageId: processedMessage.messageId,
        clientId: instance.client_id
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'YUMER message processed successfully',
        instanceName: instance.instance_id,
        messageId: processedMessage.messageId,
        clientId: instance.client_id,
        ticketId: ticketId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [YUMER-PROCESS] Erro ao processar mensagem YUMER:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process YUMER message',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// 🔧 FUNÇÃO NOVA: Garantir conexão instância-fila 
async function ensureInstanceQueueConnection(instanceUuid: string, clientId: string): Promise<void> {
  try {
    console.log('🔧 [AUTO-CONNECT] Verificando conexão instância-fila para:', instanceUuid);
    
    // Verificar se já existe conexão ativa
    const { data: existingConnection } = await supabase
      .from('instance_queue_connections')
      .select('id')
      .eq('instance_id', instanceUuid)
      .eq('is_active', true)
      .single();
    
    if (existingConnection) {
      console.log('✅ [AUTO-CONNECT] Instância já conectada a uma fila');
      return;
    }
    
    // Buscar fila ativa do cliente com assistente ativo
    const { data: availableQueue } = await supabase
      .from('queues')
      .select(`
        id,
        name,
        assistants:assistant_id (
          id,
          is_active
        )
      `)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .not('assistant_id', 'is', null)
      .single();
    
    if (!availableQueue) {
      console.log('⚠️ [AUTO-CONNECT] Nenhuma fila ativa com assistente encontrada para o cliente');
      return;
    }
    
    if (!availableQueue.assistants?.is_active) {
      console.log('⚠️ [AUTO-CONNECT] Assistente da fila não está ativo');
      return;
    }
    
    // Criar conexão automática
    const { error: connectionError } = await supabase
      .from('instance_queue_connections')
      .insert({
        instance_id: instanceUuid,
        queue_id: availableQueue.id,
        is_active: true
      });
    
    if (connectionError) {
      console.error('❌ [AUTO-CONNECT] Erro ao criar conexão:', connectionError);
      return;
    }
    
    console.log(`✅ [AUTO-CONNECT] Instância conectada automaticamente à fila: ${availableQueue.name}`);
    
  } catch (error) {
    console.error('❌ [AUTO-CONNECT] Erro na conexão automática:', error);
  }
}

// 🤖 FUNÇÃO MELHORADA: Processar com IA se habilitado
async function processWithAIIfEnabled(
  messageData: any, 
  instanceDetails: any,
  isBatch: boolean = false,
  batchSize: number = 1,
  ticketId?: string,
  allMessages?: string[]
): Promise<boolean> {
  try {
    console.log('🤖 [AI-CHECK] Verificando se deve processar com IA');
    console.log('📋 [AI-CHECK] MessageData:', { 
      fromMe: messageData.fromMe, 
      content: messageData.content?.substring(0, 50) + '...',
      messageType: messageData.messageType 
    });
    console.log('📋 [AI-CHECK] InstanceDetails recebidos:', instanceDetails);
    
    if (messageData.fromMe) {
      console.log('⚠️ [AI-CHECK] Mensagem enviada pelo próprio sistema - não processando com IA');
      return false;
    }

    // 🔍 VERIFICAÇÃO CRÍTICA: Verificar se ticket deve ser processado pela IA
    if (ticketId) {
      const shouldProcess = await shouldTicketBeProcessedByAI(ticketId);
      if (!shouldProcess.shouldProcess) {
        console.log('🚫 [AI-CHECK] Ticket não deve ser processado pela IA:', shouldProcess.reason);
        return false;
      }
    }
    
    // 🔍 BUSCAR INSTÂNCIA - CORREÇÃO CRÍTICA: usar instanceDetails correto
    console.log('🔍 [AI-CHECK] Usando instanceDetails direto - ID:', instanceDetails.id);
    
    const instanceData = instanceDetails; // Usar os dados da instância já carregados
    
    if (!instanceData || !instanceData.id || !instanceData.client_id) {
      console.log('⚠️ [AI-CHECK] Dados da instância insuficientes para verificação de IA');
      return false;
    }

    console.log('✅ [AI-CHECK] Dados da instância validados:', {
      id: instanceData.id,
      client_id: instanceData.client_id,
      instance_id: instanceData.instance_id
    });

    const clientId = instanceData.client_id;

    // Verificar se instância está conectada a uma fila com assistente ATIVO
    const { data: connection, error: connectionError } = await supabase
      .from('instance_queue_connections')
      .select(`
        *,
        queues:queue_id (
          id,
          name,
          is_active,
          assistants:assistant_id (
            id,
            name,
            prompt,
            model,
            advanced_settings,
            is_active
          )
        )
      `)
      .eq('instance_id', instanceData.id)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      console.log('ℹ️ [AI-CHECK] Instância não está conectada a nenhuma fila ativa');
      return false;
    }

    const queue = connection.queues;
    const assistant = queue?.assistants;

    if (!queue?.is_active) {
      console.log('⚠️ [AI-CHECK] Fila não está ativa');
      return false;
    }

    if (!assistant || !assistant.is_active) {
      console.log('ℹ️ [AI-CHECK] Fila não tem assistente ativo configurado');
      return false;
    }

    console.log(`🤖 [AI-TRIGGER] Processando com IA - Fila: ${queue.name}, Assistente: ${assistant.name}`);

    // 🎯 CORRIGIR INVOCAÇÃO DA IA: Passar parâmetros corretos para batches
    const messageContent = isBatch && allMessages && allMessages.length > 0 
      ? allMessages.join('\n\n') // Combinar todas as mensagens do batch
      : messageData.content;

    console.log('📋 [AI-TRIGGER] Preparando chamada para edge function com dados:', {
      ticketId: ticketId,
      instanceId: instanceData.id,
      clientId: instanceData.client_id,
      assistantId: assistant.id,
      assistantName: assistant.name,
      isBatch: isBatch,
      messageContent: messageContent?.substring(0, 100) + '...',
      contextCustomerName: messageData.contactName || messageData.pushName || 'Cliente',
      contextPhoneNumber: messageData.phoneNumber,
      contextChatId: messageData.chatId
    });

    // 🎯 CORREÇÃO CRÍTICA: Chamar edge function com parâmetros corretos
    console.log('🚀 [AI-TRIGGER] Invocando edge function ai-assistant-process...');
    const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
      body: {
        ticketId: ticketId,
        instanceId: instanceData.id, // UUID da instância correto
        clientId: instanceData.client_id, // clientId correto
        assistant: {
          id: assistant.id,
          name: assistant.name,
          prompt: assistant.prompt,
          model: assistant.model
        },
        message: isBatch ? undefined : messageData.content,
        messages: isBatch ? allMessages : undefined, // Enviar array de mensagens para batch
        context: {
          customerName: messageData.contactName || messageData.pushName || 'Cliente',
          phoneNumber: messageData.phoneNumber,
          chatId: messageData.chatId
        }
      }
    });
    
    console.log('📨 [AI-TRIGGER] Resultado da edge function:', {
      hasData: !!aiResult,
      hasError: !!aiError,
      aiResultKeys: aiResult ? Object.keys(aiResult) : null,
      errorMessage: aiError?.message
    });

    if (aiError) {
      console.error('❌ [AI-TRIGGER] Erro ao processar com IA:', aiError);
      return false;
    }

    console.log('✅ [AI-TRIGGER] IA processou mensagem com sucesso:', {
      hasResponse: !!aiResult?.response,
      sentViaYumer: aiResult?.sentViaYumer
    });

    return true;

  } catch (error) {
    console.error('❌ [AI-TRIGGER] Erro crítico no processamento de IA:', error);
    return false;
  }
}

// Função utilitária para converter Uint8Array para base64
function uint8ArrayToBase64(uint8Array: any): string {
  if (!uint8Array || typeof uint8Array !== 'object') {
    return '';
  }
  
  try {
    // Verificar se é um objeto com propriedades numéricas (Uint8Array serializado)
    if (typeof uint8Array === 'object' && !Array.isArray(uint8Array)) {
      const keys = Object.keys(uint8Array).filter(key => !isNaN(parseInt(key)));
      if (keys.length > 0) {
        const bytes = new Uint8Array(keys.length);
        keys.forEach((key, index) => {
          bytes[index] = uint8Array[key];
        });
        
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }
    }
    
    // Se é um array ou Uint8Array real
    if (Array.isArray(uint8Array) || uint8Array instanceof Uint8Array) {
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return btoa(binary);
    }
    
    // Se já é string, retornar
    if (typeof uint8Array === 'string') {
      return uint8Array;
    }
    
    return '';
  } catch (error) {
    console.warn('⚠️ Erro ao converter Uint8Array para base64:', error);
    return '';
  }
}

// Função para extrair dados da mensagem YUMER
function extractYumerMessageData(messageData: any, instance: any) {
  console.log('🔧 [EXTRACT-YUMER] Extraindo dados da mensagem YUMER');
  console.log('🔍 [EXTRACT-YUMER] MessageData recebido:', JSON.stringify(messageData, null, 2));
  
  // Extrair informações básicas - LOGGING DETALHADO
  const rawMessageId = messageData.keyId;
  const rawChatId = messageData.keyRemoteJid;
  
  console.log('🔍 [EXTRACT-YUMER] Campos de entrada:', {
    keyId: rawMessageId,
    keyRemoteJid: rawChatId,
    keyFromMe: messageData.keyFromMe,
    pushName: messageData.pushName,
    content: messageData.content,
    contentType: messageData.contentType,
    messageTimestamp: messageData.messageTimestamp
  });
  
  const messageId = rawMessageId || `yumer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Normalizar chat_id
  let chatId = rawChatId || '';
  
  console.log('🔍 [EXTRACT-YUMER] Valores extraídos (antes de validação):', {
    messageId: messageId,
    chatId: chatId,
    messageIdPresent: !!messageId,
    chatIdPresent: !!chatId
  });
  
  const fromMe = messageData.keyFromMe || false;
  const timestamp = messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000).toISOString() : new Date().toISOString();
  
  // Detectar tipo de mensagem e extrair conteúdo
  let content = '';
  let messageType = 'text';
  let mediaUrl = '';
  let mediaDuration = 0;
  let mediaMimeType = '';
  let mediaKey = '';
  let fileEncSha256 = '';
  let fileSha256 = '';
  let directPath = '';

  // 🎵 PROCESSAMENTO DE ÁUDIO - LOGS DETALHADOS
  if (messageData.contentType === 'audio') {
    console.log('🎵 [EXTRACT-YUMER] ÁUDIO DETECTADO - dados completos:', {
      contentType: messageData.contentType,
      hasContent: !!messageData.content,
      contentKeys: messageData.content ? Object.keys(messageData.content) : [],
      content: messageData.content
    });
    
    messageType = 'audio';
    content = '🎵 Mensagem de áudio';
    
    // Extrair dados do áudio com validação detalhada
    if (messageData.content?.url) {
      mediaUrl = messageData.content.url;
      console.log('✅ [EXTRACT-YUMER] URL do áudio extraída:', mediaUrl);
    } else {
      console.log('❌ [EXTRACT-YUMER] URL do áudio não encontrada em content.url');
    }
    
    if (messageData.content?.seconds) {
      mediaDuration = messageData.content.seconds;
    }
    
    if (messageData.content?.mimetype) {
      mediaMimeType = messageData.content.mimetype;
    }
    
    // Chaves de criptografia para áudio do WhatsApp
    if (messageData.content?.mediaKey) {
      mediaKey = uint8ArrayToBase64(messageData.content.mediaKey);
      console.log('🔐 [EXTRACT-YUMER] MediaKey do áudio convertida para base64 (length):', mediaKey.length);
    }
    
    if (messageData.content?.fileEncSha256) {
      fileEncSha256 = uint8ArrayToBase64(messageData.content.fileEncSha256);
      console.log('🔐 [EXTRACT-YUMER] FileEncSha256 convertido para base64 (length):', fileEncSha256.length);
    }
    
    if (messageData.content?.fileSha256) {
      fileSha256 = uint8ArrayToBase64(messageData.content.fileSha256);
      console.log('🔐 [EXTRACT-YUMER] FileSha256 convertido para base64 (length):', fileSha256.length);
    }
    
    if (messageData.content?.directPath) {
      directPath = messageData.content.directPath;
      console.log('🔗 [EXTRACT-YUMER] DirectPath extraído:', directPath);
    }
    
  } else if (messageData.contentType === 'image') {
    messageType = 'image';
    content = '📷 Imagem';
    
    if (messageData.content?.url) {
      mediaUrl = messageData.content.url;
    }
    
    if (messageData.content?.mimetype) {
      mediaMimeType = messageData.content.mimetype;
    }
    
    // Chaves de criptografia para imagem
    if (messageData.content?.mediaKey) {
      mediaKey = uint8ArrayToBase64(messageData.content.mediaKey);
    }
    
    if (messageData.content?.fileEncSha256) {
      fileEncSha256 = uint8ArrayToBase64(messageData.content.fileEncSha256);
    }
    
    if (messageData.content?.fileSha256) {
      fileSha256 = uint8ArrayToBase64(messageData.content.fileSha256);
    }
    
    if (messageData.content?.directPath) {
      directPath = messageData.content.directPath;
    }
    
  } else if (messageData.contentType === 'video') {
    messageType = 'video';
    content = '🎥 Vídeo';
    
    if (messageData.content?.url) {
      mediaUrl = messageData.content.url;
    }
    
    if (messageData.content?.seconds) {
      mediaDuration = messageData.content.seconds;
    }
    
    if (messageData.content?.mimetype) {
      mediaMimeType = messageData.content.mimetype;
    }
    
    // Chaves de criptografia para vídeo
    if (messageData.content?.mediaKey) {
      mediaKey = uint8ArrayToBase64(messageData.content.mediaKey);
    }
    
    if (messageData.content?.fileEncSha256) {
      fileEncSha256 = uint8ArrayToBase64(messageData.content.fileEncSha256);
    }
    
    if (messageData.content?.fileSha256) {
      fileSha256 = messageData.content.fileSha256;
    }
    
    if (messageData.content?.directPath) {
      directPath = messageData.content.directPath;
    }
    
  } else if (messageData.contentType === 'document') {
    messageType = 'document';
    content = '📄 Documento';
    
    if (messageData.content?.url) {
      mediaUrl = messageData.content.url;
    }
    
    if (messageData.content?.mimetype) {
      mediaMimeType = messageData.content.mimetype;
    }
    
    if (messageData.content?.fileName) {
      content = `📄 ${messageData.content.fileName}`;
    }
    
    // Chaves de criptografia para documento
    if (messageData.content?.mediaKey) {
      mediaKey = messageData.content.mediaKey;
    }
    
    if (messageData.content?.fileEncSha256) {
      fileEncSha256 = messageData.content.fileEncSha256;
    }
    
    if (messageData.content?.fileSha256) {
      fileSha256 = messageData.content.fileSha256;
    }
    
    if (messageData.content?.directPath) {
      directPath = messageData.content.directPath;
    }
    
  } else {
    // Mensagem de texto
    messageType = 'text';
    
    if (messageData.content?.body) {
      content = messageData.content.body;
    } else if (messageData.content?.text) {
      content = messageData.content.text;
    } else if (typeof messageData.content === 'string') {
      content = messageData.content;
    } else if (messageData.text) {
      content = messageData.text;
    } else if (messageData.body) {
      content = messageData.body;
    } else {
      content = 'Mensagem sem conteúdo de texto';
    }
  }
  
  // Extrair nome do contato
  let contactName = messageData.pushName || 'Usuário';
  
  // Extrair número de telefone do chat_id
  let phoneNumber = '';
  if (chatId && chatId.includes('@')) {
    phoneNumber = chatId.split('@')[0];
  }
  
  const extractedData = {
    messageId,
    chatId,
    content,
    messageType,
    fromMe,
    timestamp,
    contactName,
    phoneNumber,
    mediaUrl,
    mediaDuration,
    mediaMimeType,
    mediaKey,
    fileEncSha256,
    fileSha256,
    directPath
  };
  
  console.log('✅ [EXTRACT-YUMER] Dados extraídos com sucesso:', {
    messageId: !!extractedData.messageId,
    chatId: !!extractedData.chatId,
    content: extractedData.content.substring(0, 50),
    messageType: extractedData.messageType,
    fromMe: extractedData.fromMe,
    contactName: extractedData.contactName,
    phoneNumber: extractedData.phoneNumber,
    hasMedia: !!extractedData.mediaUrl,
    mediaType: extractedData.messageType,
    hasEncryptionKeys: !!(extractedData.mediaKey && extractedData.fileEncSha256)
  });
  
  return extractedData;
}

// Função para salvar mensagem YUMER no banco
async function saveYumerMessage(messageData: any, instanceId: string, willProcessWithAI: boolean = false) {
  console.log('💾 [SAVE-YUMER] Salvando mensagem YUMER no banco...');
  
  try {
    const messageRecord = {
      message_id: messageData.messageId,
      chat_id: messageData.chatId,
      instance_id: instanceId,
      body: messageData.content, // Mapear content → body
      message_type: messageData.messageType,
      from_me: messageData.fromMe,
      timestamp: messageData.timestamp,
      contact_name: messageData.contactName,
      phone_number: messageData.phoneNumber,
      media_url: messageData.mediaUrl || null,
      media_duration: messageData.mediaDuration || null,
      media_mime_type: messageData.mediaMimeType || null,
      media_key: messageData.mediaKey || null,
      file_enc_sha256: messageData.fileEncSha256 || null,
      file_sha256: messageData.fileSha256 || null,
      direct_path: messageData.directPath || null,
      raw_data: messageData,
      processed_at: new Date().toISOString(),
      source: 'yumer',
      // 🔥 CORREÇÃO: Marcar como não processada apenas se for para IA, caso contrário processada
      is_processed: messageData.fromMe ? true : !willProcessWithAI
    };

    console.log('💾 [SAVE-YUMER] Dados preparados para inserção:', {
      message_id: messageRecord.message_id,
      chat_id: messageRecord.chat_id,
      instance_id: messageRecord.instance_id,
      message_type: messageRecord.message_type,
      from_me: messageRecord.from_me,
      has_media: !!messageRecord.media_url,
      has_encryption_keys: !!(messageRecord.media_key && messageRecord.file_enc_sha256)
    });

    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert([messageRecord]);

    if (insertError) {
      console.error('❌ [SAVE-YUMER] Erro ao inserir mensagem:', insertError);
      throw insertError;
    }

    console.log('✅ [SAVE-YUMER] Mensagem salva com sucesso no whatsapp_messages');

  } catch (error) {
    console.error('❌ [SAVE-YUMER] Erro crítico ao salvar mensagem:', error);
    throw error;
  }
}

// Função para processar mensagem nos tickets
async function processMessageToTickets(messageData: any, clientId: string, instanceId: string) {
  console.log('🎫 [TICKETS] Processando mensagem para tickets...');
  
  try {
    // 1. Criar ou atualizar cliente
    const customerId = await createOrUpdateCustomer(
      clientId,
      messageData.contactName,
      messageData.phoneNumber,
      messageData.chatId
    );

    // 2. Criar ou atualizar ticket de conversa
    const ticketId = await createOrUpdateTicket(
      clientId,
      customerId,
      messageData.chatId,
      instanceId,
      messageData.contactName,
      messageData.content,
      messageData.timestamp
    );

    // 3. Salvar mensagem no ticket com chaves de criptografia
    await saveTicketMessage(
      ticketId,
      messageData.messageId,
      messageData.content,
      messageData.messageType,
      messageData.fromMe,
      messageData.timestamp,
      messageData.contactName,
      messageData.mediaUrl,
      messageData.mediaDuration,
      messageData.mediaKey,
      messageData.fileEncSha256,
      messageData.fileSha256
    );

    console.log('✅ [TICKETS] Mensagem processada com sucesso no sistema de tickets');
    return ticketId;

  } catch (error) {
    console.error('❌ [TICKETS] Erro ao processar mensagem para tickets:', error);
    throw error;
  }
}

// Função para criar ou atualizar cliente
async function createOrUpdateCustomer(clientId: string, customerName: string, phoneNumber: string, chatId: string) {
  console.log('👤 [CUSTOMER] Criando ou atualizando cliente...');
  
  try {
    // Buscar cliente existente
    let { data: customer, error: selectError } = await supabase
      .from('customers')
      .select('id')
      .eq('client_id', clientId)
      .eq('phone', phoneNumber)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ [CUSTOMER] Erro ao buscar cliente:', selectError);
      throw selectError;
    }

    if (!customer) {
      // Criar novo cliente
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert([{
          client_id: clientId,
          name: customerName,
          phone: phoneNumber,
          whatsapp_chat_id: chatId
        }])
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ [CUSTOMER] Erro ao criar cliente:', insertError);
        throw insertError;
      }

      console.log('✅ [CUSTOMER] Cliente criado:', newCustomer.id);
      return newCustomer.id;
    } else {
      // Atualizar cliente existente
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: customerName,
          whatsapp_chat_id: chatId,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (updateError) {
        console.error('❌ [CUSTOMER] Erro ao atualizar cliente:', updateError);
        throw updateError;
      }

      console.log('✅ [CUSTOMER] Cliente atualizado:', customer.id);
      return customer.id;
    }

  } catch (error) {
    console.error('❌ [CUSTOMER] Erro crítico:', error);
    throw error;
  }
}

// 🔧 Função CORRIGIDA para criar ou atualizar ticket COM AUTO-ASSIGNMENT
async function createOrUpdateTicket(
  clientId: string, 
  customerId: string, 
  chatId: string, 
  instanceId: string, 
  customerName: string,
  lastMessage: string,
  lastMessageAt: string
) {
  console.log('🎫 [TICKET] Criando ou atualizando ticket...');
  
  try {
    const title = `Conversa com ${customerName}`;
    
    // Buscar ticket existente
    let { data: ticket, error: selectError } = await supabase
      .from('conversation_tickets')
      .select('id, assigned_queue_id, assigned_assistant_id')
      .eq('client_id', clientId)
      .eq('chat_id', chatId)
      .eq('instance_id', instanceId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ [TICKET] Erro ao buscar ticket:', selectError);
      throw selectError;
    }

    let ticketId: string;

    if (!ticket) {
      // 🆕 CRIAR NOVO TICKET
      console.log('🆕 [TICKET] Criando novo ticket...');
      
      const { data: newTicket, error: insertError } = await supabase
        .from('conversation_tickets')
        .insert([{
          client_id: clientId,
          customer_id: customerId,
          chat_id: chatId,
          instance_id: instanceId,
          title: title,
          last_message_preview: lastMessage.substring(0, 255),
          last_message_at: lastMessageAt
        }])
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ [TICKET] Erro ao criar ticket:', insertError);
        throw insertError;
      }

      ticketId = newTicket.id;
      console.log('✅ [TICKET] Ticket criado:', ticketId);
    } else {
      // ♻️ ATUALIZAR TICKET EXISTENTE
      ticketId = ticket.id;
      
      const { error: updateError } = await supabase
        .from('conversation_tickets')
        .update({
          last_message_preview: lastMessage.substring(0, 255),
          last_message_at: lastMessageAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('❌ [TICKET] Erro ao atualizar ticket:', updateError);
        throw updateError;
      }

      console.log('✅ [TICKET] Ticket atualizado:', ticketId);

      // Se já tem fila e assistente atribuídos, retornar
      if (ticket.assigned_queue_id && ticket.assigned_assistant_id) {
        console.log('✅ [TICKET] Ticket já tem fila e assistente atribuídos');
        return ticketId;
      }
    }

    // 🤖 AUTO-ASSIGNMENT: Atribuir fila e assistente automaticamente
    console.log('🤖 [AUTO-ASSIGNMENT] Iniciando auto-assignment para ticket:', ticketId);
    
    try {
      // Buscar instância UUID pelo instance_id (string)
      const { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_id', instanceId)
        .single();

      if (instanceError || !instanceData) {
        console.error('❌ [AUTO-ASSIGNMENT] Instância não encontrada:', instanceError);
        return ticketId;
      }

      // Chamar função de auto-assignment
      const { data: assignedQueueId, error: assignmentError } = await supabase
        .rpc('auto_assign_queue', {
          p_client_id: clientId,
          p_instance_id: instanceId,
          p_message_content: lastMessage
        });

      if (assignmentError) {
        console.error('❌ [AUTO-ASSIGNMENT] Erro na função auto_assign_queue:', assignmentError);
        return ticketId;
      }

      if (!assignedQueueId) {
        console.log('⚠️ [AUTO-ASSIGNMENT] Nenhuma fila disponível para assignment');
        return ticketId;
      }

      console.log('🎯 [AUTO-ASSIGNMENT] Fila atribuída:', assignedQueueId);

      // Buscar assistente da fila
      const { data: queueData, error: queueError } = await supabase
        .from('queues')
        .select('assistant_id, name')
        .eq('id', assignedQueueId)
        .single();

      if (queueError || !queueData?.assistant_id) {
        console.error('❌ [AUTO-ASSIGNMENT] Erro ao buscar assistente da fila:', queueError);
        
        // Mesmo assim atualizar com a fila
        const { error: updateQueueError } = await supabase
          .from('conversation_tickets')
          .update({
            assigned_queue_id: assignedQueueId,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId);

        if (updateQueueError) {
          console.error('❌ [AUTO-ASSIGNMENT] Erro ao atualizar ticket com fila:', updateQueueError);
        }

        return ticketId;
      }

      // Atualizar ticket com fila e assistente
      const { error: updateTicketError } = await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: assignedQueueId,
          assigned_assistant_id: queueData.assistant_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateTicketError) {
        console.error('❌ [AUTO-ASSIGNMENT] Erro ao atualizar ticket com assignment:', updateTicketError);
        return ticketId;
      }

      console.log(`✅ [AUTO-ASSIGNMENT] Ticket atualizado com sucesso:`, {
        ticketId,
        queueId: assignedQueueId,
        queueName: queueData.name,
        assistantId: queueData.assistant_id
      });

    } catch (assignmentError) {
      console.error('❌ [AUTO-ASSIGNMENT] Erro crítico no auto-assignment:', assignmentError);
    }

    return ticketId;

  } catch (error) {
    console.error('❌ [TICKET] Erro crítico:', error);
    throw error;
  }
}

// Função para verificar se ticket deve ser processado pela IA
async function shouldTicketBeProcessedByAI(ticketId: string): Promise<{ shouldProcess: boolean; reason?: string }> {
  try {
    console.log('🔍 [WEBHOOK] Verificando se ticket deve ser processado pela IA:', ticketId);
    
    // Buscar ticket com informações da fila
    const { data: ticket, error } = await supabase
      .from('conversation_tickets')
      .select(`
        id,
        status,
        assigned_queue_id,
        human_takeover_reason,
        queues:assigned_queue_id (
          id,
          is_active,
          assistant_id,
          name
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      console.log('❌ [WEBHOOK] Ticket não encontrado:', error?.message);
      return { shouldProcess: false, reason: 'Ticket não encontrado' };
    }

    // Verificar se ticket tem fila atribuída
    if (!ticket.assigned_queue_id) {
      console.log('⚠️ [WEBHOOK] Ticket sem fila atribuída - não processando IA');
      return { shouldProcess: false, reason: 'Ticket não está em nenhuma fila' };
    }

    // Verificar se está em modo de takeover humano
    if (ticket.human_takeover_reason) {
      console.log('👤 [WEBHOOK] Ticket em modo humano - não processando IA:', ticket.human_takeover_reason);
      return { shouldProcess: false, reason: 'Ticket assumido humanamente' };
    }

    // Verificar status do ticket
    if (['pending', 'closed', 'resolved'].includes(ticket.status)) {
      console.log('🚫 [WEBHOOK] Status do ticket não permite IA:', ticket.status);
      return { shouldProcess: false, reason: `Status não permite IA: ${ticket.status}` };
    }

    // Verificar se a fila existe e está ativa
    const queue = ticket.queues;
    if (!queue) {
      console.log('❌ [WEBHOOK] Fila não encontrada para o ticket');
      return { shouldProcess: false, reason: 'Fila não encontrada' };
    }

    if (!queue.is_active) {
      console.log('⚠️ [WEBHOOK] Fila não está ativa:', queue.name);
      return { shouldProcess: false, reason: 'Fila não está ativa' };
    }

    if (!queue.assistant_id) {
      console.log('🤖 [WEBHOOK] Fila sem assistente configurado:', queue.name);
      return { shouldProcess: false, reason: 'Fila sem assistente IA configurado' };
    }

    console.log('✅ [WEBHOOK] Ticket aprovado para processamento IA:', {
      ticketId,
      queueName: queue.name,
      status: ticket.status
    });

    return { shouldProcess: true };

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro ao verificar processamento IA:', error);
    return { shouldProcess: false, reason: 'Erro interno na verificação' };
  }
}

// Função para salvar mensagem no ticket
async function saveTicketMessage(
  ticketId: string,
  messageId: string,
  content: string,
  messageType: string,
  fromMe: boolean,
  timestamp: string,
  senderName: string,
  mediaUrl?: string,
  mediaDuration?: number,
  mediaKey?: string,
  fileEncSha256?: string,
  fileSha256?: string
) {
  console.log('💬 [TICKET-MESSAGE] Salvando mensagem no ticket...');
  
  try {
    // Usar a nova função do banco que suporta chaves de criptografia
    const { data: savedMessageId, error: insertError } = await supabase
      .rpc('save_ticket_message', {
        p_ticket_id: ticketId,
        p_message_id: messageId,
        p_content: content,
        p_message_type: messageType,
        p_from_me: fromMe,
        p_timestamp: timestamp,
        p_sender_name: senderName,
        p_media_url: mediaUrl,
        p_media_duration: mediaDuration,
        p_media_key: mediaKey,
        p_file_enc_sha256: fileEncSha256,
        p_file_sha256: fileSha256
      });

    if (insertError) {
      console.error('❌ [TICKET-MESSAGE] Erro ao salvar mensagem:', insertError);
      throw insertError;
    }

    console.log('✅ [TICKET-MESSAGE] Mensagem salva no ticket');

    // 🎵 TRANSCRIÇÃO AUTOMÁTICA DE ÁUDIO
    if (messageType === 'audio' && mediaUrl && !fromMe) {
      console.log('🎵 [AUTO-TRANSCRIPTION] Iniciando transcrição automática de áudio...');
      
      try {
        // Buscar cliente para pegar configuração de IA
        const { data: ticket, error: ticketError } = await supabase
          .from('conversation_tickets')
          .select('client_id')
          .eq('id', ticketId)
          .single();

        if (ticketError || !ticket) {
          console.error('❌ [AUTO-TRANSCRIPTION] Erro ao buscar ticket:', ticketError);
          return;
        }

        const { data: aiConfig, error: configError } = await supabase
          .from('client_ai_configs')
          .select('openai_api_key')
          .eq('client_id', ticket.client_id)
          .single();

        if (configError || !aiConfig?.openai_api_key) {
          console.log('⚠️ [AUTO-TRANSCRIPTION] Configuração de IA não encontrada - pulando transcrição');
          return;
        }

        // Chamar função de transcrição
        const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
          body: {
            audioUrl: mediaUrl,
            openaiApiKey: aiConfig.openai_api_key,
            messageId: messageId
          }
        });

        if (transcriptionError) {
          console.error('❌ [AUTO-TRANSCRIPTION] Erro na transcrição:', transcriptionError);
          return;
        }

        if (transcriptionResult?.text) {
          // Atualizar mensagem com transcrição
          const { error: updateError } = await supabase
            .from('ticket_messages')
            .update({
              media_transcription: transcriptionResult.text,
              processing_status: 'transcribed'
            })
            .eq('ticket_id', ticketId)
            .eq('message_id', messageId);

          if (updateError) {
            console.error('❌ [AUTO-TRANSCRIPTION] Erro ao salvar transcrição:', updateError);
          } else {
            console.log('✅ [AUTO-TRANSCRIPTION] Transcrição salva com sucesso:', transcriptionResult.text.substring(0, 100));
          }
        }

      } catch (error) {
        console.error('❌ [AUTO-TRANSCRIPTION] Erro crítico na transcrição:', error);
      }
    }

  } catch (error) {
    console.error('❌ [TICKET-MESSAGE] Erro crítico ao salvar mensagem:', error);
    throw error;
  }
}

// 🎵 FUNÇÃO DE TRANSCRIÇÃO REMOVIDA TEMPORARIAMENTE
// Será reimplementada quando campos necessários estiverem disponíveis na tabela ticket_messages