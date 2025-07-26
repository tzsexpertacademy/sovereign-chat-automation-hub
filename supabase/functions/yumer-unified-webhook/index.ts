/**
 * Yumer API v2.2.1 Unified Webhook Handler
 * Processa todos os eventos da API Yumer incluindo mensagens, status e QR codes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WebhookEvent {
  instance: string;
  event: string;
  data: any;
  timestamp: number;
  business_id?: string;
  server_url?: string;
  apikey?: string;
}

interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message: any;
  messageTimestamp: number;
  status?: string;
}

interface WhatsAppChat {
  remoteJid: string;
  name?: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: any;
  lastMessageTimestamp?: number;
}

interface WhatsAppContact {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  isWaContact: boolean;
  verifiedName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse incoming webhook data
    const webhookData: WebhookEvent = await req.json()
    
    console.log(`📥 [YUMER-WEBHOOK-v2.2.1] Evento recebido:`, {
      instance: webhookData.instance,
      event: webhookData.event,
      timestamp: new Date().toISOString(),
      dataKeys: Object.keys(webhookData.data || {})
    })

    // Verificar se a instância existe no banco
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_id', webhookData.instance)
      .single()

    if (instanceError || !instanceData) {
      console.log(`⚠️ [YUMER-UNIFIED-WEBHOOK] Instância ${webhookData.instance} não encontrada no banco`)
      
      // Tentar encontrar por yumer_instance_name como fallback
      const { data: fallbackInstance } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('yumer_instance_name', webhookData.instance)
        .single()
      
      if (!fallbackInstance) {
        return new Response('Instance not found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }
      
      // Usar dados do fallback
      instanceData.id = fallbackInstance.id
      instanceData.instance_id = fallbackInstance.instance_id
      instanceData.client_id = fallbackInstance.client_id
    }

    // Processar evento baseado no tipo (API v2.2.1)
    switch (webhookData.event) {
      case 'qr.updated':
      case 'qrcode.updated':
      case 'qrcodeUpdated':
        await handleQRCodeUpdate(supabase, webhookData, instanceData)
        break
        
      case 'connection.update':
      case 'connectionUpdated':
        await handleConnectionUpdate(supabase, webhookData, instanceData)
        break
        
      case 'messages.upsert':
      case 'messagesUpsert':
        await handleMessagesUpsert(supabase, webhookData, instanceData)
        break
        
      case 'chats.upsert':
      case 'chats.set':
      case 'chatsUpsert':
        await handleChatsUpsert(supabase, webhookData, instanceData)
        break
        
      case 'contacts.upsert':
      case 'contactsUpsert':
        await handleContactsUpsert(supabase, webhookData, instanceData)
        break
        
      default:
        console.log(`📄 [YUMER-WEBHOOK-v2.2.1] Evento não processado: ${webhookData.event}`)
        // Salvar evento não processado para debug
        await saveUnprocessedEvent(supabase, webhookData)
    }

    // Atualizar timestamp da instância
    await supabase
      .from('whatsapp_instances')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', instanceData.id)

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('❌ [YUMER-UNIFIED-WEBHOOK] Erro:', error)
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

/**
 * Processa atualização de QR Code
 */
async function handleQRCodeUpdate(supabase: any, webhookData: WebhookEvent, instanceData: any) {
  console.log(`🔗 [QR-UPDATE] Atualizando QR Code para instância ${webhookData.instance}`)
  
  const qrCode = webhookData.data?.qr || webhookData.data

  if (qrCode) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        has_qr_code: true,
        qr_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
        status: 'qr_ready',
        connection_state: 'connecting'
      })
      .eq('id', instanceData.id)
    
    console.log(`✅ [QR-UPDATE] QR Code salvo para instância ${webhookData.instance}`)
  }
}

/**
 * Processa atualização de conexão
 */
async function handleConnectionUpdate(supabase: any, webhookData: WebhookEvent, instanceData: any) {
  console.log(`🔌 [CONNECTION-UPDATE] Estado: ${JSON.stringify(webhookData.data)}`)
  
  const connectionData = webhookData.data
  let status = 'disconnected'
  let connectionState = 'close'
  
  // Normalizar estado da conexão
  if (connectionData.state === 'open' || connectionData.connection === 'open') {
    status = 'connected'
    connectionState = 'open'
  } else if (connectionData.state === 'connecting' || connectionData.connection === 'connecting') {
    status = 'connecting'
    connectionState = 'connecting'
  } else {
    status = 'disconnected'
    connectionState = 'close'
  }

  const updates: any = {
    status,
    connection_state: connectionState
  }

  // Se conectado, limpar QR code e salvar dados do perfil
  if (status === 'connected') {
    updates.qr_code = null
    updates.has_qr_code = false
    updates.qr_expires_at = null
    
    // Salvar informações do perfil se disponíveis
    if (connectionData.ownerJid) {
      updates.phone_number = connectionData.ownerJid.split('@')[0]
    }
  }

  await supabase
    .from('whatsapp_instances')
    .update(updates)
    .eq('id', instanceData.id)
  
  console.log(`✅ [CONNECTION-UPDATE] Status atualizado para ${status}`)
}

/**
 * Processa mensagens recebidas
 */
async function handleMessagesUpsert(supabase: any, webhookData: WebhookEvent, instanceData: any) {
  console.log(`💬 [MESSAGES-UPSERT] Processando ${webhookData.data?.length || 1} mensagens`)
  
  const messages = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data]
  
  for (const msg of messages) {
    if (!msg || !msg.key) continue
    
    // Normalizar estrutura da mensagem
    const message: WhatsAppMessage = {
      key: msg.key,
      pushName: msg.pushName,
      message: msg.message,
      messageTimestamp: msg.messageTimestamp || Date.now(),
      status: msg.status
    }
    
    try {
      // Extrair dados da mensagem
      const senderId = message.key.remoteJid
      const messageContent = extractMessageContent(message.message)
      const messageType = extractMessageType(message.message)
      
      // Extrair URL de mídia se for áudio
      let mediaUrl = null;
      if (messageType === 'audio' && message.message?.audioMessage?.url) {
        mediaUrl = message.message.audioMessage.url;
        console.log(`🎵 [AUDIO] URL detectada: ${mediaUrl}`);
      }

      // Salvar mensagem no banco
      const messageData = {
        instance_id: instanceData.instance_id,
        message_id: message.key.id,
        chat_id: senderId,
        sender: senderId,
        body: messageContent,
        message_type: messageType,
        from_me: message.key.fromMe,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        is_processed: false,
        media_url: mediaUrl
      };

      await supabase
        .from('whatsapp_messages')
        .upsert(messageData, {
          onConflict: 'instance_id,message_id'
        })

      // Se não é mensagem nossa, processar para CRM
      if (!message.key.fromMe && instanceData.client_id) {
        await processMessageForCRM(supabase, message, instanceData)
      }

      // Processar áudio em background se necessário
      if (messageType === 'audio' && mediaUrl && !message.key.fromMe) {
        console.log(`🎵 [AUDIO-PROCESSING] Iniciando processamento de áudio em background`);
        processAudioTranscription(supabase, message.key.id, mediaUrl)
          .catch(error => {
            console.error('❌ [AUDIO-PROCESSING] Erro no processamento de áudio:', error);
          });
      }
      
    } catch (error) {
      console.error(`❌ [MESSAGES-UPSERT] Erro ao processar mensagem:`, error)
    }
  }
}

/**
 * Processa conversas atualizadas
 */
async function handleChatsUpsert(supabase: any, webhookData: WebhookEvent, instanceData: any) {
  console.log(`💭 [CHATS-UPSERT] Processando ${webhookData.data?.length || 1} conversas`)
  
  const chats = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data]
  
  for (const chat of chats) {
    if (!chat || !chat.remoteJid) continue
    
    try {
      await supabase
        .from('whatsapp_chats')
        .upsert({
          instance_id: instanceData.instance_id,
          chat_id: chat.remoteJid,
          name: chat.name || chat.pushName,
          is_group: chat.isGroup || false,
          unread_count: chat.unreadCount || 0,
          last_message: chat.lastMessage,
          last_message_time: chat.lastMessageTimestamp ? 
            new Date(chat.lastMessageTimestamp * 1000).toISOString() : null
        }, {
          onConflict: 'instance_id,chat_id'
        })
    } catch (error) {
      console.error(`❌ [CHATS-UPSERT] Erro ao processar conversa:`, error)
    }
  }
}

/**
 * Processa contatos atualizados
 */
async function handleContactsUpsert(supabase: any, webhookData: WebhookEvent, instanceData: any) {
  console.log(`👥 [CONTACTS-UPSERT] Processando ${webhookData.data?.length || 1} contatos`)
  
  const contacts = Array.isArray(webhookData.data) ? webhookData.data : [webhookData.data]
  
  for (const contact of contacts) {
    if (!contact || !contact.remoteJid) continue
    
    try {
      // Usar tabela whatsapp_chats para contatos (não grupos)
      if (!contact.isGroup) {
        await supabase
          .from('whatsapp_chats')
          .upsert({
            instance_id: instanceData.instance_id,
            chat_id: contact.remoteJid,
            name: contact.pushName || contact.verifiedName,
            is_group: false,
            profile_pic_url: contact.profilePicUrl,
            is_typing: false,
            is_recording: false
          }, {
            onConflict: 'instance_id,chat_id'
          })
      }
    } catch (error) {
      console.error(`❌ [CONTACTS-UPSERT] Erro ao processar contato:`, error)
    }
  }
}

/**
 * Processa mensagem para o CRM (criação de tickets)
 */
async function processMessageForCRM(supabase: any, message: WhatsAppMessage, instanceData: any) {
  try {
    const chatId = message.key.remoteJid
    const customerPhone = chatId.split('@')[0]
    const customerName = message.pushName || customerPhone
    const messageContent = extractMessageContent(message.message)
    
    // Usar função do Supabase para criar/atualizar ticket
    const { data: ticketId } = await supabase
      .rpc('upsert_conversation_ticket', {
        p_client_id: instanceData.client_id,
        p_chat_id: chatId,
        p_instance_id: instanceData.instance_id,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_last_message: messageContent,
        p_last_message_at: new Date(message.messageTimestamp * 1000).toISOString()
      })
    
    console.log(`🎫 [CRM] Ticket processado: ${ticketId}`)
    
  } catch (error) {
    console.error(`❌ [CRM] Erro ao processar para CRM:`, error)
  }
}

/**
 * Extrai conteúdo principal da mensagem
 */
function extractMessageContent(message: any): string {
  if (!message) return ''
  
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  if (message.videoMessage?.caption) return message.videoMessage.caption
  if (message.documentMessage?.caption) return message.documentMessage.caption
  
  // Mensagens de mídia sem texto
  if (message.imageMessage) return '[Imagem]'
  if (message.videoMessage) return '[Vídeo]'
  if (message.audioMessage) return '[Áudio]'
  if (message.documentMessage) return '[Documento]'
  if (message.stickerMessage) return '[Sticker]'
  if (message.locationMessage) return '[Localização]'
  if (message.contactMessage) return '[Contato]'
  
  return '[Mensagem]'
}

/**
 * Determina o tipo da mensagem
 */
function extractMessageType(message: any): string {
  if (!message) return 'text'
  
  if (message.conversation || message.extendedTextMessage) return 'text'
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  if (message.stickerMessage) return 'sticker'
  if (message.locationMessage) return 'location'
  if (message.contactMessage) return 'contact'
  
  return 'text'
}

/**
 * Processa transcrição de áudio em background
 */
async function processAudioTranscription(supabase: any, messageId: string, audioUrl: string) {
  try {
    console.log('🎵 [AUDIO-TRANSCRIPTION] Iniciando processamento:', audioUrl);
    
    // Headers otimizados para WhatsApp
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': 'https://web.whatsapp.com/',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    
    // Download do áudio
    console.log('📥 [AUDIO-TRANSCRIPTION] Fazendo download...');
    const audioResponse = await fetch(audioUrl, { 
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    });
    
    if (!audioResponse.ok) {
      console.error('❌ [AUDIO-TRANSCRIPTION] Erro no download:', audioResponse.status);
      throw new Error(`Erro ao baixar áudio: ${audioResponse.status}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log('📊 [AUDIO-TRANSCRIPTION] Áudio baixado:', audioBuffer.byteLength, 'bytes');
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Arquivo de áudio vazio');
    }
    
    // Converter para base64 de forma otimizada
    const audioBytes = new Uint8Array(audioBuffer);
    let audioBase64 = '';
    
    // Processar em chunks para evitar overflow
    const chunkSize = 0x8000;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      audioBase64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    audioBase64 = btoa(audioBase64);
    console.log('🎵 [AUDIO-TRANSCRIPTION] Convertido para base64:', audioBase64.length, 'chars');
    
    // Salvar áudio base64 primeiro
    await supabase
      .from('whatsapp_messages')
      .update({ 
        audio_base64: audioBase64,
        processing_status: 'processing_transcription'
      })
      .eq('message_id', messageId);
    
    console.log('💾 [AUDIO-TRANSCRIPTION] Base64 salvo, iniciando transcrição...');
    
    // Chamar função de transcrição
    const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: audioBase64,
        openaiApiKey: Deno.env.get('OPENAI_API_KEY')
      }
    });
    
    if (transcriptionError) {
      console.error('❌ [AUDIO-TRANSCRIPTION] Erro na transcrição:', transcriptionError);
      await supabase
        .from('whatsapp_messages')
        .update({ 
          processing_status: 'transcription_failed',
          transcription: 'Transcrição não disponível (erro no processamento)'
        })
        .eq('message_id', messageId);
      return;
    }
    
    const transcription = transcriptionResult?.text || 'Transcrição não disponível';
    console.log('✅ [AUDIO-TRANSCRIPTION] Concluída:', transcription.substring(0, 100));
    
    // Atualizar com transcrição
    await supabase
      .from('whatsapp_messages')
      .update({ 
        processing_status: 'processed',
        transcription: transcription
      })
      .eq('message_id', messageId);
    
    console.log('✅ [AUDIO-TRANSCRIPTION] Mensagem atualizada com sucesso');
    
  } catch (error) {
    console.error('❌ [AUDIO-TRANSCRIPTION] Erro crítico:', error);
    
    try {
      await supabase
        .from('whatsapp_messages')
        .update({ 
          processing_status: 'transcription_failed',
          transcription: `Erro: ${error.message}`
        })
        .eq('message_id', messageId);
    } catch (updateError) {
      console.error('❌ [AUDIO-TRANSCRIPTION] Erro ao atualizar status:', updateError);
    }
  }
}

/**
 * Salva eventos não processados para debug
 */
async function saveUnprocessedEvent(supabase: any, webhookData: WebhookEvent) {
  try {
    await supabase.from('system_logs').insert({
      level: 'info',
      message: `Evento webhook não processado: ${webhookData.event}`,
      metadata: {
        event: webhookData.event,
        instance: webhookData.instance,
        dataKeys: Object.keys(webhookData.data || {}),
        timestamp: webhookData.timestamp || Date.now()
      },
      source: 'yumer-webhook-v2.2.1'
    });
  } catch (error) {
    console.error('❌ [UNPROCESSED-EVENT] Erro ao salvar evento:', error);
  }
}