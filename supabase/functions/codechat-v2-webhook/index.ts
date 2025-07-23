
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodeChatV2Event {
  event: string;
  instance: {
    instanceId: string;
    businessId: string;
    name: string;
    state: string;
    connection: string;
  };
  data?: any;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔥 [CODECHAT-V2-WEBHOOK] Recebendo evento...');

    const payload: CodeChatV2Event = await req.json();
    console.log('📋 [CODECHAT-V2-WEBHOOK] Payload recebido:', JSON.stringify(payload, null, 2));

    // Extract event information
    const { event, instance, data, timestamp } = payload;
    const { instanceId, businessId, name, state, connection } = instance;

    // Log the event
    const { error: logError } = await supabase
      .from('system_logs')
      .insert([
        {
          level: 'info',
          message: `CodeChat v2.1.3 Event: ${event}`,
          context: 'codechat-v2-webhook',
          metadata: {
            event,
            instanceId,
            businessId,
            instanceName: name,
            state,
            connection,
            timestamp,
            ...data
          }
        }
      ]);

    if (logError) {
      console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao salvar log:', logError);
    }

    // Handle different event types
    switch (event) {
      case 'qrcodeUpdated':
      case 'qr.updated':
      case 'QR_CODE_UPDATED':
        console.log('📱 [CODECHAT-V2-WEBHOOK] Processando QR Code...');
        
        if (data?.qrCode || data?.base64) {
          // Update WhatsApp instance with QR code
          const { error: updateError } = await supabase
            .from('whatsapp_instances')
            .update({
              qr_code: data.qrCode || data.base64,
              has_qr_code: true,
              status: 'qr_ready',
              qr_expires_at: new Date(Date.now() + 60000).toISOString(), // 60 seconds
              updated_at: new Date().toISOString()
            })
            .eq('instance_id', instanceId);

          if (updateError) {
            console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao atualizar QR Code:', updateError);
          } else {
            console.log('✅ [CODECHAT-V2-WEBHOOK] QR Code atualizado com sucesso');
          }
        }
        break;

      case 'connectionUpdated':
      case 'statusInstance':
        console.log('🔄 [CODECHAT-V2-WEBHOOK] Atualizando status da conexão...');
        
        let newStatus = 'disconnected';
        if (connection === 'open') newStatus = 'connected';
        else if (connection === 'connecting') newStatus = 'connecting';
        else if (state === 'active') newStatus = 'disconnected';

        const { error: statusError } = await supabase
          .from('whatsapp_instances')
          .update({
            status: newStatus,
            connection_state: connection,
            instance_state: state,
            updated_at: new Date().toISOString()
          })
          .eq('instance_id', instanceId);

        if (statusError) {
          console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao atualizar status:', statusError);
        } else {
          console.log(`✅ [CODECHAT-V2-WEBHOOK] Status atualizado: ${newStatus}`);
        }
        break;

      case 'messagesUpsert':
      case 'sendMessage':
        console.log('📨 [CODECHAT-V2-WEBHOOK] Processando mensagem...');
        
        if (data?.messages && Array.isArray(data.messages)) {
          for (const message of data.messages) {
            try {
              // Find or create conversation ticket
              const { data: ticketData, error: ticketError } = await supabase
                .rpc('upsert_conversation_ticket', {
                  p_client_id: businessId, // Using businessId as client_id for now
                  p_chat_id: message.key?.remoteJid || 'unknown',
                  p_instance_id: instanceId,
                  p_customer_name: message.pushName || message.key?.remoteJid || 'Desconhecido',
                  p_customer_phone: message.key?.remoteJid?.replace('@s.whatsapp.net', '') || 'unknown',
                  p_last_message: message.message?.conversation || message.message?.extendedTextMessage?.text || 'Mensagem de mídia',
                  p_last_message_at: new Date(message.messageTimestamp * 1000).toISOString()
                });

              if (ticketError) {
                console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao criar/atualizar ticket:', ticketError);
              } else {
                console.log('✅ [CODECHAT-V2-WEBHOOK] Ticket atualizado:', ticketData);
              }

              // Save message
              const { error: messageError } = await supabase
                .from('messages')
                .insert([
                  {
                    ticket_id: ticketData,
                    message_id: message.key?.id || `msg_${Date.now()}`,
                    from_me: message.key?.fromMe || false,
                    remote_jid: message.key?.remoteJid || 'unknown',
                    participant: message.key?.participant,
                    message_type: Object.keys(message.message || {})[0] || 'unknown',
                    content: message.message,
                    timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                    status: 'received',
                    instance_id: instanceId
                  }
                ]);

              if (messageError) {
                console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao salvar mensagem:', messageError);
              } else {
                console.log('✅ [CODECHAT-V2-WEBHOOK] Mensagem salva com sucesso');
              }
            } catch (error) {
              console.error('❌ [CODECHAT-V2-WEBHOOK] Erro ao processar mensagem:', error);
            }
          }
        }
        break;

      default:
        console.log(`ℹ️ [CODECHAT-V2-WEBHOOK] Evento não processado: ${event}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        event,
        instanceId,
        businessId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('❌ [CODECHAT-V2-WEBHOOK] Erro no webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
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
