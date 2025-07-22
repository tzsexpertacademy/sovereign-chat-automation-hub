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

// Interface para mensagens YUMER
interface YumerWebhookData {
  event?: string;
  instance?: {
    id?: number;
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

      // NOVA LÓGICA: Detectar mensagens YUMER pelo evento e estrutura
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.id) {
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
    const instanceNumericId = yumerData.instance?.id;
    const messageData = yumerData.data;

    if (!instanceNumericId || !messageData) {
      console.error('❌ [YUMER-PROCESS] Dados insuficientes:', { instanceNumericId, hasMessageData: !!messageData });
      return new Response(
        JSON.stringify({ error: 'Insufficient data' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [YUMER-PROCESS] Buscando instância por ID numérico:', instanceNumericId);

    // 1. Buscar instância pelo instanceId numérico (campo id na tabela)
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, client_id, id')
      .eq('id', instanceNumericId)
      .single();

    if (instanceError || !instance) {
      console.error('❌ [YUMER-PROCESS] Instância não encontrada:', instanceNumericId, instanceError);
      return new Response(
        JSON.stringify({ error: 'Instance not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [YUMER-PROCESS] Instância encontrada: ${instance.instance_id} (Cliente: ${instance.client_id})`);

    // 2. Extrair e normalizar dados da mensagem
    const processedMessage = extractYumerMessageData(messageData, instance);
    
    if (!processedMessage) {
      console.warn('⚠️ [YUMER-PROCESS] Dados da mensagem não puderam ser extraídos');
      return new Response(
        JSON.stringify({ error: 'Message data could not be extracted' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 [YUMER-PROCESS] Dados da mensagem extraídos:', processedMessage);

    // 3. Salvar mensagem bruta no whatsapp_messages
    await saveYumerMessage(processedMessage, instance.instance_id);
    
    // 4. Processar mensagem para tickets
    await processMessageToTickets(processedMessage, instance.client_id, instance.instance_id);
    
    console.log('✅ [YUMER-PROCESS] Mensagem YUMER processada com sucesso');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'YUMER message processed successfully',
        instanceName: instance.instance_id,
        messageId: processedMessage.messageId,
        clientId: instance.client_id,
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

// Função para extrair dados da mensagem YUMER
function extractYumerMessageData(messageData: any, instance: any) {
  console.log('🔧 [EXTRACT-YUMER] Extraindo dados da mensagem YUMER');
  
  // Extrair informações básicas
  const messageId = messageData.keyId || `yumer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Normalizar chat_id
  let chatId = messageData.keyRemoteJid || '';
  
  const fromMe = messageData.keyFromMe || false;
  const timestamp = messageData.messageTimestamp ? new Date(messageData.messageTimestamp * 1000).toISOString() : new Date().toISOString();
  
  // Extrair conteúdo da mensagem
  let content = '';
  if (messageData.content?.text) {
    content = messageData.content.text;
  } else if (typeof messageData.content === 'string') {
    content = messageData.content;
  }
  
  let messageType = messageData.messageType || 'text';
  
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
    sender: messageData.pushName || phoneNumber
  };

  console.log('✅ [EXTRACT-YUMER] Dados extraídos:', processedMessage);
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
      is_processed: false // Será marcado como true após processamento completo
    });

  if (error) {
    console.error('❌ [SAVE-YUMER] Erro ao salvar:', error);
    throw error;
  }

  console.log('✅ [SAVE-YUMER] Mensagem YUMER salva no whatsapp_messages');
}

// Função para processar mensagem para sistema de tickets
async function processMessageToTickets(messageData: any, clientId: string, instanceId: string) {
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
