// CodeChat API v2.1.3 Webhook - Novo modelo Business/Instance
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CodeChatV2Event {
  event: string;
  instance: {
    instanceId: string;
    instanceName: string;
    businessId: string;
  };
  data: any;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 [CODECHAT-V2-WEBHOOK] Recebendo evento...');
    
    let webhookData: CodeChatV2Event;
    const contentType = req.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      webhookData = await req.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const dataStr = formData.get('data') as string;
      webhookData = JSON.parse(dataStr);
    } else {
      const text = await req.text();
      webhookData = JSON.parse(text);
    }

    console.log('📨 [CODECHAT-V2-WEBHOOK] Evento recebido:', {
      event: webhookData.event,
      instanceId: webhookData.instance?.instanceId,
      businessId: webhookData.instance?.businessId,
      timestamp: webhookData.timestamp
    });

    // Processar eventos baseado no tipo
    switch (webhookData.event) {
      case 'qrcodeUpdated':
      case 'qr.updated':
      case 'QR_CODE_UPDATED':
        await processQRCodeV2(webhookData);
        break;
        
      case 'messagesUpsert':
      case 'messages.upsert':
        await processMessageUpsertV2(webhookData);
        break;
        
      case 'connectionUpdated':
      case 'connection.update':
        await processConnectionUpdateV2(webhookData);
        break;
        
      case 'statusInstance':
      case 'instance.status':
        await processInstanceStatusV2(webhookData);
        break;
        
      default:
        console.log(`⚠️ [CODECHAT-V2-WEBHOOK] Evento não processado: ${webhookData.event}`);
    }

    return new Response(
      JSON.stringify({ success: true, processed: webhookData.event }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        message: error.message 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// Processar QR Code atualizado (v2.1.3)
async function processQRCodeV2(webhookData: CodeChatV2Event) {
  console.log('📱 [CODECHAT-V2-WEBHOOK] Processando QR Code v2.1.3...');
  
  try {
    const qrData = webhookData.data;
    const instanceId = webhookData.instance.instanceId;
    
    if (!qrData?.base64) {
      console.log('⚠️ [CODECHAT-V2-WEBHOOK] QR Code sem dados base64');
      return;
    }

    // Atualizar QR Code na instância
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrData.base64,
        has_qr_code: true,
        qr_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
        status: 'qr_ready',
        updated_at: new Date().toISOString()
      })
      .eq('instance_id', instanceId);

    if (error) {
      console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao salvar QR Code:', error);
    } else {
      console.log('✅ [CODECHAT-V2-WEBHOOK] QR Code salvo para instância:', instanceId);
    }

  } catch (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao processar QR Code:', error);
  }
}

// Processar mensagens (v2.1.3)
async function processMessageUpsertV2(webhookData: CodeChatV2Event) {
  console.log('💬 [CODECHAT-V2-WEBHOOK] Processando mensagem v2.1.3...');
  
  try {
    const messageData = webhookData.data;
    const instanceId = webhookData.instance.instanceId;
    const businessId = webhookData.instance.businessId;
    
    // Buscar instância para obter client_id
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('client_id')
      .eq('instance_id', instanceId)
      .single();

    if (instanceError || !instance) {
      console.error('❌ [CODECHAT-V2-WEBHOOK] Instância não encontrada:', instanceId);
      return;
    }

    const clientId = instance.client_id;

    // Normalizar dados da mensagem para v2.1.3
    const normalizedMessage = normalizeMessageDataV2(messageData, instanceId);
    
    // Salvar mensagem no WhatsApp
    await saveWhatsAppMessageV2(normalizedMessage, instanceId);
    
    // Criar/atualizar customer e ticket
    const customerId = await createOrUpdateCustomerV2(clientId, normalizedMessage);
    const ticketId = await createOrUpdateTicketV2(clientId, instanceId, normalizedMessage, customerId);
    
    // Salvar mensagem do ticket
    await saveTicketMessageV2(ticketId, normalizedMessage);
    
    console.log('✅ [CODECHAT-V2-WEBHOOK] Mensagem processada com sucesso');

  } catch (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao processar mensagem:', error);
  }
}

// Processar atualização de conexão (v2.1.3)
async function processConnectionUpdateV2(webhookData: CodeChatV2Event) {
  console.log('🔌 [CODECHAT-V2-WEBHOOK] Processando atualização de conexão v2.1.3...');
  
  try {
    const connectionData = webhookData.data;
    const instanceId = webhookData.instance.instanceId;
    
    const status = connectionData.connection || connectionData.state || 'unknown';
    
    // Atualizar status da instância
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status: status,
        phone_number: connectionData.ownerJid ? extractPhoneFromJid(connectionData.ownerJid) : null,
        updated_at: new Date().toISOString()
      })
      .eq('instance_id', instanceId);

    if (error) {
      console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao atualizar conexão:', error);
    } else {
      console.log('✅ [CODECHAT-V2-WEBHOOK] Status atualizado:', { instanceId, status });
    }

  } catch (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao processar conexão:', error);
  }
}

// Processar status da instância (v2.1.3)
async function processInstanceStatusV2(webhookData: CodeChatV2Event) {
  console.log('📊 [CODECHAT-V2-WEBHOOK] Processando status da instância v2.1.3...');
  
  try {
    const statusData = webhookData.data;
    const instanceId = webhookData.instance.instanceId;
    
    // Atualizar informações da instância
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (statusData.connection) {
      updateData.status = statusData.connection;
    }
    
    if (statusData.ownerJid) {
      updateData.phone_number = extractPhoneFromJid(statusData.ownerJid);
    }
    
    const { error } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('instance_id', instanceId);

    if (error) {
      console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao atualizar status:', error);
    } else {
      console.log('✅ [CODECHAT-V2-WEBHOOK] Status da instância atualizado:', instanceId);
    }

  } catch (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao processar status:', error);
  }
}

// Funções auxiliares adaptadas para v2.1.3
function normalizeMessageDataV2(messageData: any, instanceId: string) {
  return {
    message_id: messageData.keyId || messageData.id || Date.now().toString(),
    chat_id: messageData.keyRemoteJid || messageData.chatId,
    sender: messageData.pushName || messageData.senderName || 'Unknown',
    body: extractMessageContent(messageData.content) || messageData.text || '',
    message_type: messageData.messageType || 'text',
    timestamp: messageData.messageTimestamp ? 
      new Date(messageData.messageTimestamp * 1000).toISOString() : 
      new Date().toISOString(),
    from_me: messageData.keyFromMe || false,
    instance_id: instanceId
  };
}

function extractMessageContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    return content.text || content.body || content.caption || '[Mídia]';
  }
  return String(content);
}

function extractPhoneFromJid(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0].replace(/\D/g, '');
}

async function saveWhatsAppMessageV2(messageData: any, instanceId: string) {
  const { error } = await supabase
    .from('whatsapp_messages')
    .insert({
      message_id: messageData.message_id,
      chat_id: messageData.chat_id,
      instance_id: instanceId,
      sender: messageData.sender,
      body: messageData.body,
      message_type: messageData.message_type,
      timestamp: messageData.timestamp,
      from_me: messageData.from_me,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao salvar mensagem WhatsApp:', error);
  }
}

async function createOrUpdateCustomerV2(clientId: string, messageData: any): Promise<string> {
  const phoneNumber = extractPhoneFromJid(messageData.chat_id);
  const customerName = messageData.sender || `Cliente ${phoneNumber}`;

  const { data, error } = await supabase
    .from('customers')
    .upsert({
      client_id: clientId,
      name: customerName,
      phone: phoneNumber,
      whatsapp_chat_id: messageData.chat_id,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'client_id,phone'
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao criar/atualizar customer:', error);
    throw error;
  }

  return data.id;
}

async function createOrUpdateTicketV2(clientId: string, instanceId: string, messageData: any, customerId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: messageData.chat_id,
      p_instance_id: instanceId,
      p_customer_name: messageData.sender,
      p_customer_phone: extractPhoneFromJid(messageData.chat_id),
      p_last_message: messageData.body.substring(0, 255),
      p_last_message_at: messageData.timestamp
    });

  if (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao criar/atualizar ticket:', error);
    throw error;
  }

  return data;
}

async function saveTicketMessageV2(ticketId: string, messageData: any) {
  const { error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      message_id: messageData.message_id,
      content: messageData.body,
      message_type: messageData.message_type,
      from_me: messageData.from_me,
      sender_name: messageData.sender,
      timestamp: messageData.timestamp,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao salvar mensagem do ticket:', error);
  }
}