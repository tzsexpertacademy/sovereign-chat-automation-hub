
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodeChatMessage {
  event: string;
  instance: {
    name: string;
    id: number;
  };
  data?: {
    id?: number;
    keyId?: string;
    keyFromMe?: boolean;
    keyRemoteJid?: string;
    keyParticipant?: string;
    pushName?: string;
    messageType?: string;
    content?: any;
    messageTimestamp?: number;
    device?: string;
    isGroup?: boolean;
    state?: string;
    statusReason?: number;
    qrcode?: {
      code: string;
      base64: string;
    };
  };
  date?: {
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
    console.log('📨 [CODECHAT-WEBHOOK] Recebendo webhook:', req.method, req.url);
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = req.headers.get('content-type');
    console.log('📋 [CODECHAT-WEBHOOK] Content-Type:', contentType);

    let webhookData: CodeChatMessage;

    // Parse different content types
    if (contentType?.includes('application/json')) {
      webhookData = await req.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const dataStr = formData.get('data') as string;
      webhookData = JSON.parse(dataStr);
    } else {
      const text = await req.text();
      console.log('📋 [CODECHAT-WEBHOOK] Raw text:', text);
      
      try {
        webhookData = JSON.parse(text);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('📨 [CODECHAT-WEBHOOK] Dados recebidos:', JSON.stringify(webhookData, null, 2));

    // === PROCESSAR MENSAGENS (message.upsert) ===
    if (webhookData.event === 'message.upsert' || webhookData.event === 'messages.upsert') {
      return await processMessageUpsert(webhookData);
    }

    // === PROCESSAR QR CODE ===
    if (webhookData.event === 'qrcodeUpdated' || 
        webhookData.event === 'qrcode.updated' || 
        webhookData.event === 'qr.updated' ||
        webhookData.event === 'qr-updated' ||
        webhookData.event === 'QR_CODE_UPDATED') {
      return await processQRCode(webhookData);
    }

    // === PROCESSAR CONEXÃO ===
    if (webhookData.event === 'connection.update') {
      return await processConnectionUpdate(webhookData);
    }

    // Outros tipos de webhook
    console.log(`📋 [CODECHAT-WEBHOOK] Webhook recebido: ${webhookData.event}`);
    
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
    console.error('❌ [CODECHAT-WEBHOOK] Erro ao processar webhook:', error);
    
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

// === PROCESSAR MENSAGENS ===
async function processMessageUpsert(webhookData: CodeChatMessage) {
  console.log('💬 [MESSAGE-UPSERT] Processando mensagem...');
  
  const messageData = webhookData.data;
  if (!messageData) {
    console.warn('⚠️ [MESSAGE-UPSERT] Dados da mensagem não encontrados');
    return createErrorResponse('Message data not found', 400);
  }

  const instanceName = webhookData.instance?.name;
  if (!instanceName) {
    console.warn('⚠️ [MESSAGE-UPSERT] Nome da instância não encontrado');
    return createErrorResponse('Instance name not found', 400);
  }

  try {
    // 1. Buscar instância no banco
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, client_id, id')
      .eq('instance_id', instanceName)
      .single();

    if (instanceError || !instance) {
      console.error('❌ [MESSAGE-UPSERT] Instância não encontrada:', instanceName, instanceError);
      return createErrorResponse('Instance not found', 404);
    }

    console.log(`✅ [MESSAGE-UPSERT] Instância encontrada: ${instance.instance_id} (Cliente: ${instance.client_id})`);

    // 2. Normalizar dados da mensagem
    const normalizedMessage = normalizeMessageData(messageData, instance);
    
    if (!normalizedMessage) {
      console.warn('⚠️ [MESSAGE-UPSERT] Não foi possível normalizar dados da mensagem');
      return createErrorResponse('Failed to normalize message data', 400);
    }

    console.log('📊 [MESSAGE-UPSERT] Mensagem normalizada:', normalizedMessage);

    // 3. Salvar mensagem no whatsapp_messages
    await saveWhatsAppMessage(normalizedMessage, instance.instance_id);
    
    // 4. Criar/atualizar customer
    const customerId = await createOrUpdateCustomer(instance.client_id, normalizedMessage);
    
    // 5. Criar/atualizar ticket
    const ticketId = await createOrUpdateTicket(instance.client_id, instance.instance_id, normalizedMessage, customerId);
    
    // 6. Salvar mensagem no ticket
    await saveTicketMessage(ticketId, normalizedMessage);
    
    console.log('✅ [MESSAGE-UPSERT] Mensagem processada com sucesso');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message processed successfully',
        instanceName,
        messageId: normalizedMessage.messageId,
        ticketId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [MESSAGE-UPSERT] Erro ao processar mensagem:', error);
    return createErrorResponse('Failed to process message', 500);
  }
}

// === PROCESSAR QR CODE ===
async function processQRCode(webhookData: CodeChatMessage) {
  console.log('🎯 [QR-CODE] QR Code webhook detectado');
  
  const instanceName = webhookData.instance?.name;
  const qrCode = webhookData.date?.qrcode?.base64 || 
                 webhookData.data?.qrcode?.base64;
  
  if (!instanceName) {
    console.warn('⚠️ [QR-CODE] Nome da instância não encontrado');
    return createErrorResponse('Instance name not found', 400);
  }

  if (!qrCode) {
    console.warn('⚠️ [QR-CODE] QR Code não encontrado no webhook');
    return createErrorResponse('QR Code not found', 400);
  }

  console.log(`✅ [QR-CODE] QR Code recebido para instância: ${instanceName}`);

  try {
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        has_qr_code: true,
        qr_expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
        status: 'qr_ready',
        updated_at: new Date().toISOString()
      })
      .eq('instance_id', instanceName);

    if (error) {
      console.error('❌ [QR-CODE] Erro ao salvar QR Code:', error);
      throw error;
    }

    console.log(`💾 [QR-CODE] QR Code salvo no banco para instância: ${instanceName}`);

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
  } catch (error) {
    console.error('❌ [QR-CODE] Erro de banco:', error);
    return createErrorResponse('Database error', 500);
  }
}

// === PROCESSAR CONEXÃO ===
async function processConnectionUpdate(webhookData: CodeChatMessage) {
  console.log('📡 [CONNECTION] Connection update webhook detectado');
  
  const instanceName = webhookData.instance?.name;
  const connectionData = webhookData.data;
  
  if (!instanceName) {
    console.warn('⚠️ [CONNECTION] Nome da instância não encontrado');
    return createErrorResponse('Instance name not found', 400);
  }
  
  console.log(`📊 [CONNECTION] Connection update para ${instanceName}:`, connectionData);
  
  try {
    let status = 'disconnected';
    if (connectionData?.state === 'open') {
      status = 'connected';
    } else if (connectionData?.state === 'connecting') {
      status = 'connecting';
    } else if (connectionData?.state === 'close') {
      status = 'disconnected';
    }
    
    await supabase
      .from('whatsapp_instances')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('instance_id', instanceName);
      
    console.log(`💾 [CONNECTION] Status atualizado para ${instanceName}: ${status}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection webhook processed',
        instanceName,
        status,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌ [CONNECTION] Erro ao atualizar status:', error);
    return createErrorResponse('Database error', 500);
  }
}

// === FUNÇÕES AUXILIARES ===

function normalizeMessageData(messageData: any, instance: any) {
  const messageId = messageData.keyId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Normalizar chat_id
  let chatId = messageData.keyRemoteJid || '';
  if (chatId.includes('@s.whatsapp.net')) {
    chatId = chatId.replace('@s.whatsapp.net', '@c.us');
  }
  
  const fromMe = messageData.keyFromMe || false;
  const timestamp = messageData.messageTimestamp ? 
    new Date(messageData.messageTimestamp * 1000).toISOString() : 
    new Date().toISOString();
  
  // Extrair conteúdo da mensagem
  let content = '';
  if (messageData.content) {
    if (typeof messageData.content === 'string') {
      content = messageData.content;
    } else if (messageData.content.text) {
      content = messageData.content.text;
    } else if (messageData.content.conversation) {
      content = messageData.content.conversation;
    } else if (messageData.content.caption) {
      content = messageData.content.caption;
    } else {
      content = '[Mídia]';
    }
  }
  
  const messageType = messageData.messageType || 'text';
  
  // USAR O PUSHNAME DIRETAMENTE DO WEBHOOK
  const contactName = formatContactName(messageData.pushName, chatId);
  const phoneNumber = extractPhoneNumber(chatId);

  return {
    messageId,
    chatId,
    fromMe,
    content,
    messageType,
    timestamp,
    contactName,
    phoneNumber,
    pushName: messageData.pushName || contactName,
    sender: messageData.pushName || contactName
  };
}

function formatContactName(pushName: string | undefined, chatId: string): string {
  // PRIORIDADE 1: usar pushName se válido
  if (pushName && pushName.trim() && !pushName.match(/^\d+$/) && !pushName.includes('@')) {
    return pushName.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // PRIORIDADE 2: usar número formatado
  const phoneNumber = extractPhoneNumber(chatId);
  return formatPhoneForDisplay(phoneNumber);
}

function extractPhoneNumber(chatId: string): string {
  if (!chatId) return '';
  
  let phone = chatId.split('@')[0];
  phone = phone.replace(/\D/g, '');
  
  // Remover DDI 55 se presente
  if (phone.startsWith('55') && phone.length >= 12) {
    phone = phone.slice(2);
  }
  
  return phone;
}

function formatPhoneForDisplay(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  return phoneNumber;
}

async function saveWhatsAppMessage(messageData: any, instanceId: string) {
  console.log('💾 [SAVE-MESSAGE] Salvando mensagem no whatsapp_messages');
  
  const { error } = await supabase
    .from('whatsapp_messages')
    .insert({
      message_id: messageData.messageId,
      chat_id: messageData.chatId,
      instance_id: instanceId,
      sender: messageData.sender,
      body: messageData.content,
      message_type: messageData.messageType,
      from_me: messageData.fromMe,
      timestamp: messageData.timestamp,
      is_processed: true
    });

  if (error) {
    console.error('❌ [SAVE-MESSAGE] Erro ao salvar:', error);
    throw error;
  }

  console.log('✅ [SAVE-MESSAGE] Mensagem salva no whatsapp_messages');
}

async function createOrUpdateCustomer(clientId: string, messageData: any): Promise<string> {
  console.log('👤 [CUSTOMER] Criando/atualizando customer');
  
  // Verificar se customer já existe
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('phone', messageData.phoneNumber)
    .single();

  if (existingCustomer) {
    // Atualizar nome se temos um nome melhor
    if (messageData.contactName && 
        messageData.contactName !== 'Contato sem nome' &&
        !messageData.contactName.includes('(') &&
        (existingCustomer.name === 'Contato sem nome' || 
         existingCustomer.name.includes('(') ||
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
    // Criar novo customer
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

async function createOrUpdateTicket(clientId: string, instanceId: string, messageData: any, customerId: string): Promise<string> {
  console.log('🎫 [TICKET] Criando/atualizando ticket');
  
  // Verificar se ticket já existe
  const { data: existingTicket } = await supabase
    .from('conversation_tickets')
    .select('id')
    .eq('client_id', clientId)
    .eq('chat_id', messageData.chatId)
    .single();

  const title = `Conversa com ${messageData.contactName}`;

  if (existingTicket) {
    // Atualizar ticket existente
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
    // Criar novo ticket
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

async function saveTicketMessage(ticketId: string, messageData: any) {
  console.log('💾 [TICKET-MESSAGE] Salvando mensagem do ticket');
  
  const { error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      message_id: messageData.messageId,
      from_me: messageData.fromMe,
      sender_name: messageData.fromMe ? 'Atendente' : messageData.contactName,
      content: messageData.content,
      message_type: messageData.messageType,
      timestamp: messageData.timestamp,
      is_internal_note: false,
      is_ai_response: false,
      processing_status: 'received'
    });

  if (error) {
    console.error('❌ [TICKET-MESSAGE] Erro ao salvar:', error);
    throw error;
  }

  console.log('✅ [TICKET-MESSAGE] Mensagem do ticket salva');
}

function createErrorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ 
      error: message,
      timestamp: new Date().toISOString()
    }), 
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
