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

serve(async (req) => {
  console.log('🌐 [YUMER-WEBHOOK] Recebendo requisição:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (for webhook testing)
  if (req.method === 'GET') {
    const origin = req.headers.get('origin') || 'unknown';
    console.log('✅ [YUMER-WEBHOOK] GET request - Origin:', origin);
    
    return new Response(
      JSON.stringify({
        status: 'active',
        message: 'YUMER Webhook Endpoint',
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
      console.log('📨 [YUMER-WEBHOOK] POST recebido - Body length:', body.length);
      
      let webhookData: YumerWebhookData;
      
      try {
        webhookData = JSON.parse(body);
      } catch (parseError) {
        console.error('❌ [YUMER-WEBHOOK] Erro ao fazer parse do JSON:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('📋 [YUMER-WEBHOOK] Dados YUMER recebidos:', JSON.stringify(webhookData, null, 2));

      // DETECTAR MENSAGENS YUMER pelo evento e estrutura
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.instanceId) {
        console.log('🎯 [YUMER-WEBHOOK] Detectada mensagem YUMER - processando...');
        return await processYumerMessage(webhookData);
      }

      // Log outros eventos para debug
      if (webhookData.event) {
        console.log(`📋 [YUMER-WEBHOOK] Evento não processado: ${webhookData.event}`);
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
      console.error('❌ [YUMER-WEBHOOK] Erro crítico:', error);
      
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

// Função para processar mensagens YUMER
async function processYumerMessage(yumerData: YumerWebhookData) {
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
    try {
      await saveYumerMessage(processedMessage, instance.instance_id);
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
    
    // 🤖 5. ATIVAÇÃO AUTOMÁTICA DA IA: Verificar se deve processar com IA
    if (!processedMessage.fromMe) {
      console.log('🤖 [AI-TRIGGER] Mensagem recebida (não enviada) - verificando se deve processar com IA');
      
      try {
        const aiResult = await processWithAIIfEnabled(ticketId, processedMessage, instance.client_id, instance.instance_id);
        console.log('🤖 [AI-TRIGGER] Resultado do processamento de IA:', aiResult ? 'sucesso' : 'não processado');
      } catch (aiError) {
        console.error('❌ [AI-TRIGGER] Erro ao processar com IA:', aiError);
      }
    }
    
    console.log('✅ [YUMER-PROCESS] Mensagem YUMER processada com sucesso');
    
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

// 🤖 FUNÇÃO MELHORADA: Processar com IA se habilitado
async function processWithAIIfEnabled(ticketId: string, messageData: any, clientId: string, instanceId: string): Promise<boolean> {
  try {
    console.log('🤖 [AI-CHECK] Verificando se instância tem fila com assistente ativo');
    
    // Buscar instância pelo instance_id para pegar o UUID
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_id', instanceId)
      .single();

    if (instanceError || !instanceData) {
      console.log('⚠️ [AI-CHECK] Instância não encontrada para verificação de IA');
      return false;
    }

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

    // Chamar edge function de processamento de IA com timeout e retry
    const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
      body: {
        ticketId: ticketId,
        message: messageData.content,
        clientId: clientId,
        instanceId: instanceId,
        assistant: {
          id: assistant.id,
          name: assistant.name,
          prompt: assistant.prompt,
          model: assistant.model || 'gpt-4o-mini',
          settings: assistant.advanced_settings
        },
        context: {
          customerName: messageData.contactName,
          phoneNumber: messageData.phoneNumber,
          chatId: messageData.chatId
        }
      }
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

    // 🔐 EXTRAIR METADADOS DE CRIPTOGRAFIA
    if (messageData.content?.mediaKey) {
      // Converter array de bytes para base64
      if (Array.isArray(messageData.content.mediaKey)) {
        mediaKey = btoa(String.fromCharCode(...messageData.content.mediaKey));
      } else if (typeof messageData.content.mediaKey === 'string') {
        mediaKey = messageData.content.mediaKey;
      }
    }
    
    if (messageData.content?.fileEncSha256) {
      if (Array.isArray(messageData.content.fileEncSha256)) {
        fileEncSha256 = btoa(String.fromCharCode(...messageData.content.fileEncSha256));
      } else if (typeof messageData.content.fileEncSha256 === 'string') {
        fileEncSha256 = messageData.content.fileEncSha256;
      }
    }
    
    if (messageData.content?.fileSha256) {
      if (Array.isArray(messageData.content.fileSha256)) {
        fileSha256 = btoa(String.fromCharCode(...messageData.content.fileSha256));
      } else if (typeof messageData.content.fileSha256 === 'string') {
        fileSha256 = messageData.content.fileSha256;
      }
    }
    
    if (messageData.content?.directPath) {
      directPath = messageData.content.directPath;
    }
    
    console.log('🎵 [EXTRACT-YUMER] Dados de áudio extraídos:', {
      mediaUrl: mediaUrl || 'NÃO ENCONTRADA',
      mediaDuration,
      mediaMimeType: mediaMimeType || 'Não especificado'
    });

    console.log('🔐 [EXTRACT-YUMER] Metadados de criptografia extraídos:', {
      mediaKey: mediaKey ? 'Presente (' + mediaKey.length + ' chars)' : 'AUSENTE',
      fileEncSha256: fileEncSha256 ? 'Presente (' + fileEncSha256.length + ' chars)' : 'AUSENTE',
      fileSha256: fileSha256 ? 'Presente (' + fileSha256.length + ' chars)' : 'AUSENTE',
      directPath: directPath || 'AUSENTE'
    });
  }
  // 📝 PROCESSAMENTO DE TEXTO
  else if (messageData.content?.text) {
    content = messageData.content.text;
    messageType = 'text';
  } else if (typeof messageData.content === 'string') {
    content = messageData.content;
    messageType = 'text';
  }
  
  // Extrair nome do contato
  const contactName = extractContactName(messageData.pushName, chatId);
  
  // Extrair número de telefone
  const phoneNumber = extractPhoneNumber(chatId);

  const processedMessage = {
    messageId,
    chatId,
    fromMe,
    content,
    messageType,
    timestamp,
    contactName,
    phoneNumber,
    author: messageData.pushName || contactName,
    pushName: messageData.pushName || contactName,
    sender: messageData.pushName || phoneNumber,
    // Dados de mídia para áudio
    mediaUrl,
    mediaDuration,
    mediaMimeType,
    // Metadados de criptografia para áudio
    mediaKey,
    fileEncSha256,
    fileSha256,
    directPath
  };

  console.log('✅ [EXTRACT-YUMER] Dados extraídos (FINAL):', JSON.stringify(processedMessage, null, 2));
  console.log('🔍 [EXTRACT-YUMER] Validação essencial:', {
    messageIdPresent: !!processedMessage.messageId,
    chatIdPresent: !!processedMessage.chatId,
    messageIdValue: processedMessage.messageId,
    chatIdValue: processedMessage.chatId
  });
  
  return processedMessage;
}

// Função para extrair nome do contato
function extractContactName(pushName: string | undefined, chatId: string): string {
  if (pushName && pushName.trim() && !pushName.includes('@') && !pushName.match(/^\d+$/)) {
    return formatCustomerName(pushName.trim());
  }
  
  return formatPhoneForDisplay(extractPhoneNumber(chatId));
}

// Função para extrair número de telefone
function extractPhoneNumber(chatId: string): string {
  if (!chatId) return '';
  
  let phone = chatId.split('@')[0];
  phone = phone.replace(/\D/g, '');
  
  return phone;
}

// Função para formatar nome do cliente
function formatCustomerName(rawName: string): string {
  if (!rawName || rawName.trim() === '') {
    return 'Contato sem nome';
  }

  const cleanName = rawName.trim();
  
  if (/^\d+$/.test(cleanName)) {
    return 'Contato sem nome';
  }
  
  if (cleanName.includes('@')) {
    return 'Contato sem nome';
  }
  
  if (cleanName.length < 2) {
    return cleanName;
  }
  
  return cleanName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Função para formatar telefone para exibição
function formatPhoneForDisplay(phoneNumber: string): string {
  const cleanedNumber = phoneNumber.replace(/\D/g, '');

  if (cleanedNumber.length === 10) {
    return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanedNumber.length === 11) {
    return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  return phoneNumber;
}

// Função para salvar mensagem YUMER no whatsapp_messages
async function saveYumerMessage(messageData: any, instanceId: string) {
  console.log('💾 [SAVE-YUMER] Salvando mensagem YUMER no whatsapp_messages');
  
  const dataToInsert = {
    message_id: messageData.messageId,
    chat_id: messageData.chatId,
    instance_id: instanceId,
    sender: messageData.sender,
    body: messageData.content,
    message_type: messageData.messageType,
    from_me: messageData.fromMe,
    timestamp: messageData.timestamp,
    is_processed: false, // Será marcado como true após processamento completo
    // Metadados de criptografia para áudio
    media_key: messageData.mediaKey || null,
    file_enc_sha256: messageData.fileEncSha256 || null,
    file_sha256: messageData.fileSha256 || null,
    direct_path: messageData.directPath || null
  };

  console.log('💾 [SAVE-YUMER] Dados a serem inseridos:', JSON.stringify(dataToInsert, null, 2));

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert(dataToInsert)
    .select('id');

  if (error) {
    console.error('❌ [SAVE-YUMER] Erro detalhado ao salvar:', {
      error: error,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      dataToInsert: dataToInsert
    });
    throw error;
  }

  console.log('✅ [SAVE-YUMER] Mensagem YUMER salva no whatsapp_messages com ID:', data?.[0]?.id);
  return data?.[0]?.id;
}

// Função para processar mensagem para sistema de tickets
async function processMessageToTickets(messageData: any, clientId: string, instanceId: string): Promise<string> {
  console.log('🎫 [PROCESS-TICKETS] Processando mensagem para sistema de tickets');
  
  try {
    // 1. Criar/atualizar customer
    const customerId = await createOrUpdateCustomer(clientId, messageData);
    
    // 2. Criar/atualizar ticket
    const ticketId = await createOrUpdateTicket(clientId, instanceId, messageData, customerId);
    
    // 3. Salvar mensagem no ticket
    await saveTicketMessage(ticketId, messageData);
    
    // 4. Marcar mensagem como processada
    await supabase
      .from('whatsapp_messages')
      .update({ is_processed: true })
      .eq('message_id', messageData.messageId);
    
    console.log('✅ [PROCESS-TICKETS] Mensagem processada para tickets com sucesso');
    
    return ticketId;
    
  } catch (error) {
    console.error('❌ [PROCESS-TICKETS] Erro ao processar para tickets:', error);
    throw error;
  }
}

// Função para criar/atualizar customer
async function createOrUpdateCustomer(clientId: string, messageData: any): Promise<string> {
  console.log('👤 [CUSTOMER] Criando/atualizando customer');
  
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('phone', messageData.phoneNumber)
    .single();

  if (existingCustomer) {
    if (messageData.contactName && 
        messageData.contactName !== 'Contato sem nome' &&
        (existingCustomer.name === 'Contato sem nome' || 
         existingCustomer.name.startsWith('Contato ') ||
         existingCustomer.name === messageData.phoneNumber)) {
      
      await supabase
        .from('customers')
        .update({
          name: messageData.contactName,
          whatsapp_chat_id: messageData.chatId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id);
      
      console.log('👤 [CUSTOMER] Nome atualizado:', messageData.contactName);
    }
    
    return existingCustomer.id;
  } else {
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        client_id: clientId,
        name: messageData.contactName,
        phone: messageData.phoneNumber,
        whatsapp_chat_id: messageData.chatId
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ [CUSTOMER] Erro ao criar:', error);
      throw error;
    }

    console.log('👤 [CUSTOMER] Novo customer criado:', messageData.contactName);
    return newCustomer.id;
  }
}

// Função para criar/atualizar ticket
async function createOrUpdateTicket(clientId: string, instanceId: string, messageData: any, customerId: string): Promise<string> {
  console.log('🎫 [TICKET] Criando/atualizando ticket');
  
  const { data: existingTicket } = await supabase
    .from('conversation_tickets')
    .select('id')
    .eq('client_id', clientId)
    .eq('chat_id', messageData.chatId)
    .single();

  const title = `Conversa com ${messageData.contactName}`;

  if (existingTicket) {
    await supabase
      .from('conversation_tickets')
      .update({
        customer_id: customerId,
        title: title,
        last_message_preview: messageData.content,
        last_message_at: messageData.timestamp,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingTicket.id);
    
    console.log('🎫 [TICKET] Ticket atualizado:', existingTicket.id);
    return existingTicket.id;
  } else {
    const { data: newTicket, error } = await supabase
      .from('conversation_tickets')
      .insert({
        client_id: clientId,
        customer_id: customerId,
        chat_id: messageData.chatId,
        instance_id: instanceId,
        title: title,
        status: 'open',
        priority: 1,
        last_message_preview: messageData.content,
        last_message_at: messageData.timestamp
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ [TICKET] Erro ao criar:', error);
      throw error;
    }

    console.log('🎫 [TICKET] Novo ticket criado:', newTicket.id);
    return newTicket.id;
  }
}

// Função para salvar mensagem na tabela ticket_messages
async function saveTicketMessage(ticketId: string, messageData: any) {
  console.log('💾 [TICKET-MESSAGE] Salvando mensagem do ticket');
  
  // Preparar dados base da mensagem
  const ticketMessageData: any = {
    ticket_id: ticketId,
    message_id: messageData.messageId,
    from_me: messageData.fromMe,
    sender_name: messageData.fromMe ? 'Atendente' : messageData.contactName,
    content: messageData.content,
    message_type: messageData.messageType,
    timestamp: messageData.timestamp,
    is_internal_note: false,
    is_ai_response: false,
    processing_status: messageData.messageType === 'audio' ? 'pending_transcription' : 'received'
  };

  // ✨ Adicionar dados de mídia para áudio
  if (messageData.messageType === 'audio') {
    if (messageData.mediaUrl) {
      ticketMessageData.media_url = messageData.mediaUrl;
    }
    if (messageData.mediaDuration) {
      ticketMessageData.media_duration = messageData.mediaDuration;
    }
    
    console.log('🎵 [TICKET-MESSAGE] Incluindo dados de áudio:', {
      media_url: ticketMessageData.media_url,
      media_duration: ticketMessageData.media_duration,
      message_type: ticketMessageData.message_type
    });
  }

  const { error } = await supabase
    .from('ticket_messages')
    .insert(ticketMessageData);

  if (error) {
    console.error('❌ [TICKET-MESSAGE] Erro ao salvar:', error);
    throw error;
  }

  console.log('✅ [TICKET-MESSAGE] Mensagem do ticket salva');

  // 🎵 PROCESSAR TRANSCRIÇÃO DE ÁUDIO EM BACKGROUND
  if (messageData.messageType === 'audio' && messageData.mediaUrl) {
    console.log('🎵 [AUDIO-PROCESS] Iniciando processamento de áudio em background');
    
    // Chamar função de transcrição de áudio sem aguardar resultado
    processAudioTranscription(ticketId, messageData.messageId, messageData.mediaUrl)
      .catch(error => {
        console.error('❌ [AUDIO-PROCESS] Erro no processamento de áudio:', error);
      });
  }
}

// 🎵 Função para processar transcrição de áudio em background
async function processAudioTranscription(ticketId: string, messageId: string, audioUrl: string) {
  try {
    console.log('🎵 [TRANSCRIPTION] Iniciando transcrição de áudio:', audioUrl);
    
    // Headers específicos para WhatsApp
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': 'https://web.whatsapp.com/',
      'Connection': 'keep-alive'
    };
    
    // Fazer download do áudio com headers específicos
    console.log('📥 [TRANSCRIPTION] Fazendo download do áudio...');
    const audioResponse = await fetch(audioUrl, { 
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    });
    
    if (!audioResponse.ok) {
      console.error('❌ [TRANSCRIPTION] Erro no download:', audioResponse.status, audioResponse.statusText);
      throw new Error(`Erro ao baixar áudio: ${audioResponse.status} - ${audioResponse.statusText}`);
    }
    
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    console.log('📄 [TRANSCRIPTION] Content-Type do áudio:', contentType);
    
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log('📊 [TRANSCRIPTION] Áudio baixado:', audioBuffer.byteLength, 'bytes');
    
    // Converter para base64 de forma otimizada
    const audioBase64 = btoa(
      new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    console.log('🎵 [TRANSCRIPTION] Áudio convertido para base64, tamanho:', audioBase64.length);
    
    // Sempre salvar o áudio_base64, independente da transcrição
    await supabase
      .from('ticket_messages')
      .update({ 
        audio_base64: audioBase64,
        processing_status: 'processing_transcription'
      })
      .eq('message_id', messageId);
    
    console.log('💾 [TRANSCRIPTION] Audio base64 salvo, iniciando transcrição...');
    
    // Chamar edge function de speech-to-text
    const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: audioBase64,
        openaiApiKey: Deno.env.get('OPENAI_API_KEY')
      }
    });
    
    if (transcriptionError) {
      console.error('❌ [TRANSCRIPTION] Erro na transcrição:', transcriptionError);
      
      // Manter o áudio, mas marcar erro na transcrição
      await supabase
        .from('ticket_messages')
        .update({ 
          processing_status: 'transcription_failed',
          media_transcription: 'Transcrição não disponível (erro no processamento)'
        })
        .eq('message_id', messageId);
      
      console.log('⚠️ [TRANSCRIPTION] Transcrição falhou, mas áudio foi salvo');
      return;
    }
    
    const transcription = transcriptionResult?.text || 'Transcrição não disponível';
    
    console.log('✅ [TRANSCRIPTION] Transcrição concluída:', {
      success: transcriptionResult?.success,
      textLength: transcription.length,
      preview: transcription.substring(0, 100)
    });
    
    // Atualizar mensagem com transcrição
    await supabase
      .from('ticket_messages')
      .update({ 
        processing_status: 'processed',
        media_transcription: transcription
      })
      .eq('message_id', messageId);
    
    console.log('✅ [TRANSCRIPTION] Mensagem atualizada com transcrição completa');
    
  } catch (error) {
    console.error('❌ [TRANSCRIPTION] Erro crítico na transcrição:', error);
    
    // Tentar salvar pelo menos um marcador de erro
    try {
      await supabase
        .from('ticket_messages')
        .update({ 
          processing_status: 'transcription_failed',
          media_transcription: `Erro no processamento: ${error.message}`
        })
        .eq('message_id', messageId);
    } catch (updateError) {
      console.error('❌ [TRANSCRIPTION] Erro ao atualizar status de erro:', updateError);
    }
  }
}
