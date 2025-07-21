
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface WhatsAppWebhookData {
  event: string;
  instance: {
    name: string;
    id: number;
  };
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: any;
    messageTimestamp?: number;
    pushName?: string;
    participant?: string;
    body?: string;
    type?: string;
    from?: string;
    to?: string;
    author?: string;
    notifyName?: string;
    qrcode?: {
      base64: string;
      code: string;
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
      
      let webhookData: WhatsAppWebhookData;
      
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

      console.log('📋 [YUMER-WEBHOOK] Dados recebidos:', JSON.stringify(webhookData, null, 2));

      // Processar diferentes tipos de eventos
      if (webhookData.event === 'qrcodeUpdated' || 
          webhookData.event === 'qrcode.updated' || 
          webhookData.event === 'qr.updated' ||
          webhookData.event === 'qr-updated' ||
          webhookData.event === 'QR_CODE_UPDATED') {
        
        console.log('🎯 [YUMER-WEBHOOK] Processando QR Code webhook');
        return await processQRCodeWebhook(webhookData);
        
      } else if (webhookData.event === 'messages.upsert' || 
                 webhookData.event === 'message' ||
                 webhookData.event === 'message.new' ||
                 webhookData.event === 'messages.set') {
        
        console.log('📨 [YUMER-WEBHOOK] Processando webhook de mensagem');
        return await processMessageWebhook(webhookData);
        
      } else if (webhookData.event === 'connection.update') {
        
        console.log('📡 [YUMER-WEBHOOK] Processando webhook de conexão');
        return await processConnectionWebhook(webhookData);
        
      } else {
        console.log(`📋 [YUMER-WEBHOOK] Evento não processado: ${webhookData.event}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Webhook received but not processed',
            event: webhookData.event
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

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

// Função para processar QR Code webhooks
async function processQRCodeWebhook(webhookData: WhatsAppWebhookData) {
  console.log('🎯 [QR-WEBHOOK] Processando QR Code');
  
  const instanceName = webhookData.instance?.name;
  
  // Buscar QR Code em múltiplas localizações possíveis
  const qrCode = webhookData.date?.qrcode?.base64 || 
                 webhookData.data?.qrcode?.base64 ||
                 webhookData.data?.qr ||
                 webhookData.data?.base64;
  
  if (!instanceName) {
    console.warn('⚠️ [QR-WEBHOOK] Nome da instância não encontrado');
    return new Response(
      JSON.stringify({ error: 'Instance name not found' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!qrCode) {
    console.warn('⚠️ [QR-WEBHOOK] QR Code não encontrado no webhook');
    return new Response(
      JSON.stringify({ error: 'QR Code not found' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`✅ [QR-WEBHOOK] QR Code recebido para instância: ${instanceName}`);

  // Salvar QR Code no banco de dados
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
      console.error('❌ [QR-WEBHOOK] Erro ao salvar QR Code:', error);
    } else {
      console.log(`💾 [QR-WEBHOOK] QR Code salvo no banco para instância: ${instanceName}`);
    }
  } catch (dbError) {
    console.error('❌ [QR-WEBHOOK] Erro de banco:', dbError);
  }

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
}

// Função para processar webhooks de conexão
async function processConnectionWebhook(webhookData: WhatsAppWebhookData) {
  console.log('📡 [CONNECTION-WEBHOOK] Processando atualização de conexão');
  
  const instanceName = webhookData.instance?.name;
  const connectionData = webhookData.data;
  
  if (!instanceName) {
    console.warn('⚠️ [CONNECTION-WEBHOOK] Nome da instância não encontrado');
    return new Response(
      JSON.stringify({ error: 'Instance name not found' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log(`📊 [CONNECTION-WEBHOOK] Connection update para ${instanceName}:`, connectionData);
  
  // Salvar atualização de status no banco
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
      
    console.log(`💾 [CONNECTION-WEBHOOK] Status atualizado para ${instanceName}: ${status}`);
  } catch (dbError) {
    console.error('❌ [CONNECTION-WEBHOOK] Erro ao atualizar status:', dbError);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Connection webhook processed',
      instanceName,
      timestamp: new Date().toISOString()
    }), 
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Função para processar webhooks de mensagem - NOVA IMPLEMENTAÇÃO
async function processMessageWebhook(webhookData: WhatsAppWebhookData) {
  console.log('📨 [MESSAGE-WEBHOOK] ===== PROCESSANDO MENSAGEM =====');
  console.log('📋 [MESSAGE-WEBHOOK] Dados completos:', JSON.stringify(webhookData, null, 2));
  
  const instanceName = webhookData.instance?.name;
  
  if (!instanceName) {
    console.warn('⚠️ [MESSAGE-WEBHOOK] Nome da instância não encontrado');
    return new Response(
      JSON.stringify({ error: 'Instance name not found' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Buscar informações da instância no banco
  const { data: instanceData, error: instanceError } = await supabase
    .from('whatsapp_instances')
    .select('client_id, id')
    .eq('instance_id', instanceName)
    .single();

  if (instanceError || !instanceData) {
    console.error('❌ [MESSAGE-WEBHOOK] Instância não encontrada no banco:', instanceError);
    return new Response(
      JSON.stringify({ error: 'Instance not found in database' }), 
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientId = instanceData.client_id;
  console.log(`👤 [MESSAGE-WEBHOOK] Cliente ID: ${clientId}`);

  // Extrair dados da mensagem
  const messageData = extractMessageData(webhookData);
  
  if (!messageData) {
    console.warn('⚠️ [MESSAGE-WEBHOOK] Dados da mensagem não puderam ser extraídos');
    return new Response(
      JSON.stringify({ error: 'Message data could not be extracted' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('📊 [MESSAGE-WEBHOOK] Dados da mensagem extraídos:', messageData);

  try {
    // 1. Salvar mensagem na tabela whatsapp_messages
    await saveWhatsAppMessage(messageData, instanceName);
    
    // 2. Criar/atualizar customer
    const customerId = await createOrUpdateCustomer(clientId, messageData);
    
    // 3. Criar/atualizar conversation_ticket
    const ticketId = await createOrUpdateTicket(clientId, instanceName, messageData, customerId);
    
    // 4. Salvar mensagem na tabela ticket_messages
    await saveTicketMessage(ticketId, messageData);
    
    console.log('✅ [MESSAGE-WEBHOOK] Mensagem processada com sucesso');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message webhook processed successfully',
        instanceName,
        messageId: messageData.messageId,
        ticketId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [MESSAGE-WEBHOOK] Erro ao processar mensagem:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process message',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// Função para extrair dados da mensagem do webhook
function extractMessageData(webhookData: WhatsAppWebhookData) {
  console.log('🔧 [EXTRACT-MESSAGE] Extraindo dados da mensagem');
  
  const data = webhookData.data;
  if (!data) {
    console.warn('⚠️ [EXTRACT-MESSAGE] Dados não encontrados no webhook');
    return null;
  }

  // Extrair informações básicas
  const messageId = data.key?.id || data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chatId = data.key?.remoteJid || data.from || data.to;
  const fromMe = data.key?.fromMe || false;
  const timestamp = data.messageTimestamp || Date.now();
  
  // Extrair conteúdo da mensagem
  let content = data.body || data.message?.conversation || data.message?.text || '';
  let messageType = data.type || 'text';
  
  // Processar diferentes tipos de mensagem
  if (data.message) {
    const msg = data.message;
    
    if (msg.imageMessage) {
      content = `[Imagem] ${msg.imageMessage.caption || 'Imagem enviada'}`;
      messageType = 'image';
    } else if (msg.audioMessage || msg.pttMessage) {
      content = `[Áudio] Mensagem de áudio`;
      messageType = 'audio';
    } else if (msg.videoMessage) {
      content = `[Vídeo] ${msg.videoMessage.caption || 'Vídeo enviado'}`;
      messageType = 'video';
    } else if (msg.documentMessage) {
      content = `[Documento] ${msg.documentMessage.fileName || 'Documento enviado'}`;
      messageType = 'document';
    } else if (msg.stickerMessage) {
      content = `[Figurinha] Figurinha enviada`;
      messageType = 'sticker';
    } else if (msg.locationMessage) {
      content = `[Localização] Localização compartilhada`;
      messageType = 'location';
    }
  }

  // Extrair nome do contato
  const contactName = extractContactName(data, chatId);
  
  // Extrair número de telefone
  const phoneNumber = extractPhoneNumber(chatId);

  const messageData = {
    messageId,
    chatId,
    fromMe,
    content,
    messageType,
    timestamp: new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp).toISOString(),
    contactName,
    phoneNumber,
    author: data.author || data.participant || contactName,
    pushName: data.pushName || data.notifyName || contactName
  };

  console.log('✅ [EXTRACT-MESSAGE] Dados extraídos:', messageData);
  return messageData;
}

// Função para extrair nome do contato
function extractContactName(data: any, chatId: string) {
  // Tentar múltiplas fontes para o nome
  const name = data.pushName || 
               data.notifyName || 
               data.participant || 
               data.author ||
               data.contact?.name ||
               data.contact?.pushname;

  if (name && name.trim() && !name.includes('@') && !name.match(/^\d+$/)) {
    return formatCustomerName(name.trim());
  }

  // Se não encontrou nome, usar telefone formatado
  return formatPhoneForDisplay(extractPhoneNumber(chatId));
}

// Função para extrair número de telefone
function extractPhoneNumber(chatId: string) {
  if (!chatId) return '';
  
  // Remover sufixos do WhatsApp (@s.whatsapp.net, @g.us)
  let phone = chatId.split('@')[0];
  
  // Remover caracteres não numéricos
  phone = phone.replace(/\D/g, '');
  
  return phone;
}

// Função para formatar nome do cliente
function formatCustomerName(rawName: string) {
  if (!rawName || rawName.trim() === '') {
    return 'Contato sem nome';
  }

  const cleanName = rawName.trim();
  
  // Se é apenas um número, retornar como contato sem nome
  if (/^\d+$/.test(cleanName)) {
    return 'Contato sem nome';
  }
  
  // Se contém @, retornar como contato sem nome
  if (cleanName.includes('@')) {
    return 'Contato sem nome';
  }
  
  // Se é muito curto, retornar como está
  if (cleanName.length < 2) {
    return cleanName;
  }
  
  // Nome válido - capitalizar primeira letra de cada palavra
  return cleanName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Função para formatar telefone para exibição
function formatPhoneForDisplay(phoneNumber: string) {
  const cleanedNumber = phoneNumber.replace(/\D/g, '');

  if (cleanedNumber.length === 10) {
    return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanedNumber.length === 11) {
    return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  return phoneNumber;
}

// Função para salvar mensagem na tabela whatsapp_messages
async function saveWhatsAppMessage(messageData: any, instanceId: string) {
  console.log('💾 [SAVE-WA-MESSAGE] Salvando mensagem WhatsApp');
  
  const { error } = await supabase
    .from('whatsapp_messages')
    .insert({
      message_id: messageData.messageId,
      chat_id: messageData.chatId,
      instance_id: instanceId,
      sender: messageData.author,
      body: messageData.content,
      message_type: messageData.messageType,
      from_me: messageData.fromMe,
      timestamp: messageData.timestamp,
      is_processed: false
    });

  if (error) {
    console.error('❌ [SAVE-WA-MESSAGE] Erro ao salvar:', error);
    throw error;
  }

  console.log('✅ [SAVE-WA-MESSAGE] Mensagem WhatsApp salva');
}

// Função para criar/atualizar customer
async function createOrUpdateCustomer(clientId: string, messageData: any) {
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

// Função para criar/atualizar ticket
async function createOrUpdateTicket(clientId: string, instanceId: string, messageData: any, customerId: string) {
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

// Função para salvar mensagem na tabela ticket_messages
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
