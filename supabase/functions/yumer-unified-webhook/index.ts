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
        console.log('🎯 [YUMER-UNIFIED-WEBHOOK] Detectada mensagem YUMER - processando...');
        return await processYumerMessage(webhookData);
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
    
    // Chaves de criptografia para áudio do WhatsApp
    if (messageData.content?.mediaKey) {
      mediaKey = messageData.content.mediaKey;
      console.log('🔐 [EXTRACT-YUMER] MediaKey do áudio extraída (primeiros 20 chars):', mediaKey.substring(0, 20));
    }
    
    if (messageData.content?.fileEncSha256) {
      fileEncSha256 = messageData.content.fileEncSha256;
      console.log('🔐 [EXTRACT-YUMER] FileEncSha256 extraído');
    }
    
    if (messageData.content?.fileSha256) {
      fileSha256 = messageData.content.fileSha256;
      console.log('🔐 [EXTRACT-YUMER] FileSha256 extraído');
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
async function saveYumerMessage(messageData: any, instanceId: string) {
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
      source: 'yumer'
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

    // 3. Salvar mensagem no ticket
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
      messageData.mediaMimeType,
      messageData.mediaKey,
      messageData.fileEncSha256,
      messageData.fileSha256,
      messageData.directPath
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

// Função para criar ou atualizar ticket
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
      .select('id')
      .eq('client_id', clientId)
      .eq('chat_id', chatId)
      .eq('instance_id', instanceId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ [TICKET] Erro ao buscar ticket:', selectError);
      throw selectError;
    }

    if (!ticket) {
      // Criar novo ticket
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

      console.log('✅ [TICKET] Ticket criado:', newTicket.id);
      return newTicket.id;
    } else {
      // Atualizar ticket existente
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

      console.log('✅ [TICKET] Ticket atualizado:', ticket.id);
      return ticket.id;
    }

  } catch (error) {
    console.error('❌ [TICKET] Erro crítico:', error);
    throw error;
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
  mediaMimeType?: string,
  mediaKey?: string,
  fileEncSha256?: string,
  fileSha256?: string,
  directPath?: string
) {
  console.log('💬 [TICKET-MESSAGE] Salvando mensagem no ticket...');
  
  try {
    const messageRecord = {
      ticket_id: ticketId,
      message_id: messageId,
      content: content,
      message_type: messageType,
      from_me: fromMe,
      timestamp: timestamp,
      sender_name: senderName,
      media_url: mediaUrl || null,
      media_duration: mediaDuration || null,
      media_mime_type: mediaMimeType || null,
      transcription: null,
      transcription_status: null
    };

    const { error: insertError } = await supabase
      .from('ticket_messages')
      .insert([messageRecord]);

    if (insertError) {
      console.error('❌ [TICKET-MESSAGE] Erro ao salvar mensagem:', insertError);
      throw insertError;
    }

    console.log('✅ [TICKET-MESSAGE] Mensagem salva no ticket');

    // 🎵 TRANSCRIÇÃO AUTOMÁTICA DE ÁUDIO
    if (messageType === 'audio' && mediaUrl && mediaKey && fileEncSha256) {
      console.log('🎵 [AUDIO-TRANSCRIPTION] Iniciando transcrição de áudio em background...');
      
      // Executar transcrição em background (não bloquear resposta)
      processAudioTranscription(ticketId, messageId, mediaUrl, mediaKey, fileEncSha256, fileSha256, directPath)
        .catch(transcriptionError => {
          console.error('❌ [AUDIO-TRANSCRIPTION] Erro na transcrição em background:', transcriptionError);
        });
    }

  } catch (error) {
    console.error('❌ [TICKET-MESSAGE] Erro crítico ao salvar mensagem:', error);
    throw error;
  }
}

// 🎵 Função para processar transcrição de áudio
async function processAudioTranscription(
  ticketId: string,
  messageId: string,
  mediaUrl: string,
  mediaKey: string,
  fileEncSha256: string,
  fileSha256?: string,
  directPath?: string
) {
  console.log('🎵 [AUDIO-TRANSCRIPTION] Iniciando processamento de transcrição de áudio');
  
  try {
    // Atualizar status para "processing"
    await supabase
      .from('ticket_messages')
      .update({ transcription_status: 'processing' })
      .eq('ticket_id', ticketId)
      .eq('message_id', messageId);

    console.log('🎵 [AUDIO-TRANSCRIPTION] Status atualizado para "processing"');

    // 1. Descriptografar áudio usando edge function
    console.log('🔐 [AUDIO-DECRYPT] Descriptografando áudio...');
    
    const { data: decryptResult, error: decryptError } = await supabase.functions.invoke('whatsapp-decrypt-audio', {
      body: {
        mediaUrl: mediaUrl,
        mediaKey: mediaKey,
        fileEncSha256: fileEncSha256,
        fileSha256: fileSha256,
        directPath: directPath
      }
    });

    if (decryptError || !decryptResult?.success) {
      console.error('❌ [AUDIO-DECRYPT] Erro ao descriptografar áudio:', decryptError || decryptResult?.error);
      
      await supabase
        .from('ticket_messages')
        .update({ 
          transcription_status: 'error',
          transcription: 'Erro na descriptografia do áudio'
        })
        .eq('ticket_id', ticketId)
        .eq('message_id', messageId);
      
      return;
    }

    const audioBuffer = decryptResult.audioBuffer;
    console.log('✅ [AUDIO-DECRYPT] Áudio descriptografado com sucesso');

    // 2. Transcrever áudio usando edge function
    console.log('🎤 [SPEECH-TO-TEXT] Transcrevendo áudio...');
    
    const { data: transcriptResult, error: transcriptError } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audioBuffer: audioBuffer,
        audioFormat: 'ogg' // WhatsApp geralmente usa OGG/Opus
      }
    });

    if (transcriptError || !transcriptResult?.success) {
      console.error('❌ [SPEECH-TO-TEXT] Erro na transcrição:', transcriptError || transcriptResult?.error);
      
      await supabase
        .from('ticket_messages')
        .update({ 
          transcription_status: 'error',
          transcription: 'Erro na transcrição do áudio'
        })
        .eq('ticket_id', ticketId)
        .eq('message_id', messageId);
      
      return;
    }

    const transcription = transcriptResult.transcript;
    console.log('✅ [SPEECH-TO-TEXT] Transcrição concluída:', transcription?.substring(0, 100));

    // 3. Salvar transcrição no banco
    await supabase
      .from('ticket_messages')
      .update({ 
        transcription_status: 'completed',
        transcription: transcription
      })
      .eq('ticket_id', ticketId)
      .eq('message_id', messageId);

    console.log('✅ [AUDIO-TRANSCRIPTION] Transcrição salva com sucesso');

  } catch (error) {
    console.error('❌ [AUDIO-TRANSCRIPTION] Erro crítico na transcrição:', error);
    
    // Atualizar status para erro
    try {
      await supabase
        .from('ticket_messages')
        .update({ 
          transcription_status: 'error',
          transcription: 'Erro interno na transcrição'
        })
        .eq('ticket_id', ticketId)
        .eq('message_id', messageId);
    } catch (updateError) {
      console.error('❌ [AUDIO-TRANSCRIPTION] Erro ao atualizar status de erro:', updateError);
    }
  }
}