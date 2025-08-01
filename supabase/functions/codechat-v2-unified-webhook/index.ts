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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const webhookData: WebhookEvent = await req.json()
    console.log('📨 Webhook recebido:', JSON.stringify(webhookData, null, 2))

    const { instance, event, data } = webhookData

    // Buscar instância no Supabase
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_id', instance)
      .single()

    if (instanceError || !instanceData) {
      console.error('❌ Instância não encontrada:', instance)
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Processar eventos baseado no tipo
    switch (event) {
      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, instanceData, data)
        break

      case 'connection.update':
        await handleConnectionUpdate(supabase, instanceData, data)
        break

      case 'messages.upsert':
        await handleMessagesUpsert(supabase, instanceData, data)
        break

      case 'chats.upsert':
        await handleChatsUpsert(supabase, instanceData, data)
        break

      case 'contacts.upsert':
        await handleContactsUpsert(supabase, instanceData, data)
        break

      default:
        console.log(`ℹ️ Evento não processado: ${event}`)
    }

    // Atualizar última atividade da instância
    await supabase
      .from('whatsapp_instances')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', instanceData.id)

    return new Response(
      JSON.stringify({ success: true, processed: event }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro no webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleQRCodeUpdate(supabase: any, instanceData: any, data: any) {
  console.log('📱 Processando atualização de QR Code')
  
  const qrCode = data.qr || data.code || data.qrcode
  
  if (qrCode) {
    // QR Code disponível - atualizar no banco
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        has_qr_code: true,
        qr_expires_at: new Date(Date.now() + 45000).toISOString(), // 45 segundos
        state: 'connecting',
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceData.id)
    
    console.log('✅ QR Code atualizado no banco')
  }
}

async function handleConnectionUpdate(supabase: any, instanceData: any, data: any) {
  console.log('🔌 Processando atualização de conexão')
  
  const state = data.state || data.connection || data.status
  let profileName = data.profileName || data.pushName
  let profilePicUrl = data.profilePicUrl || data.profilePic
  let ownerJid = data.jid || data.number

  // Mapear estados para o padrão v2.2.1
  let normalizedState = 'close'
  switch (state) {
    case 'open':
    case 'connected':
      normalizedState = 'open'
      break
    case 'connecting':
    case 'qr':
      normalizedState = 'connecting'
      break
    default:
      normalizedState = 'close'
  }

  const updateData: any = {
    state: normalizedState,
    updated_at: new Date().toISOString()
  }

  // Se conectado, limpar QR Code e atualizar dados do perfil
  if (normalizedState === 'open') {
    updateData.qr_code = null
    updateData.has_qr_code = false
    updateData.qr_expires_at = null
    
    if (profileName) updateData.profile_name = profileName
    if (profilePicUrl) updateData.profile_pic_url = profilePicUrl
    if (ownerJid) updateData.owner_jid = ownerJid
  }

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('id', instanceData.id)

  console.log(`✅ Estado da conexão atualizado: ${normalizedState}`)
}

async function handleMessagesUpsert(supabase: any, instanceData: any, data: any) {
  console.log('💬 Processando mensagens')
  
  // Normalizar dados - pode vir como array ou objeto único
  const messages = Array.isArray(data) ? data : [data]
  
  for (const messageData of messages) {
    const message = messageData.message || messageData
    
    if (!message.key) continue

    // Extrair dados da mensagem
    const keyRemoteJid = message.key.remoteJid
    const keyFromMe = message.key.fromMe || false
    const keyId = message.key.id
    const pushName = message.pushName || ''
    const messageTimestamp = message.messageTimestamp || Date.now()
    const messageContent = extractMessageContent(message.message)
    const messageType = extractMessageType(message.message)

    // Inserir/atualizar mensagem
    await supabase
      .from('whatsapp_messages')
      .upsert({
        instance_id: instanceData.instance_id,
        chat_id: keyRemoteJid,
        message_id: keyId,
        key_remote_jid: keyRemoteJid,
        key_from_me: keyFromMe,
        key_id: keyId,
        from_me: keyFromMe,
        sender: pushName,
        push_name: pushName,
        body: messageContent,
        message_type: messageType,
        message_timestamp: messageTimestamp,
        timestamp: new Date(messageTimestamp).toISOString(),
        status: 'received',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'instance_id,message_id',
        ignoreDuplicates: false
      })

    console.log(`✅ Mensagem processada: ${keyId}`)
  }
}

async function handleChatsUpsert(supabase: any, instanceData: any, data: any) {
  console.log('💬 Processando chats')
  
  const chats = Array.isArray(data) ? data : [data]
  
  for (const chatData of chats) {
    const remoteJid = chatData.id || chatData.remoteJid
    if (!remoteJid) continue

    const isGroup = remoteJid.includes('@g.us')
    const name = chatData.name || chatData.subject || ''
    const unreadCount = chatData.unreadCount || 0

    await supabase
      .from('whatsapp_chats')
      .upsert({
        instance_id: instanceData.instance_id,
        chat_id: remoteJid,
        remote_jid: remoteJid,
        name: name,
        is_group: isGroup,
        is_wa_contact: !isGroup,
        unread_count: unreadCount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'instance_id,chat_id',
        ignoreDuplicates: false
      })

    console.log(`✅ Chat processado: ${remoteJid}`)
  }
}

async function handleContactsUpsert(supabase: any, instanceData: any, data: any) {
  console.log('👥 Processando contatos')
  
  const contacts = Array.isArray(data) ? data : [data]
  
  for (const contactData of contacts) {
    const remoteJid = contactData.id || contactData.remoteJid
    if (!remoteJid || remoteJid.includes('@g.us')) continue // Pular grupos

    await supabase
      .from('whatsapp_chats')
      .upsert({
        instance_id: instanceData.instance_id,
        chat_id: remoteJid,
        remote_jid: remoteJid,
        push_name: contactData.pushName || contactData.name || '',
        is_group: false,
        is_wa_contact: true,
        verified_name: contactData.verifiedName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'instance_id,chat_id',
        ignoreDuplicates: false
      })

    console.log(`✅ Contato processado: ${remoteJid}`)
  }
}

function extractMessageContent(messageObj: any): string {
  if (!messageObj) return ''
  
  // Mensagem de texto
  if (messageObj.conversation) return messageObj.conversation
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text
  
  // Mensagens de mídia
  if (messageObj.imageMessage?.caption) return messageObj.imageMessage.caption || '[Imagem]'
  if (messageObj.videoMessage?.caption) return messageObj.videoMessage.caption || '[Vídeo]'
  if (messageObj.documentMessage) return '[Documento]'
  if (messageObj.audioMessage) return '[Áudio]'
  if (messageObj.stickerMessage) return '[Sticker]'
  if (messageObj.locationMessage) return '[Localização]'
  if (messageObj.contactMessage) return '[Contato]'
  
  return '[Mensagem]'
}

function extractMediaData(messageObj: any): any {
  if (!messageObj) return null
  
  // Áudio
  if (messageObj.audioMessage) {
    return {
      media_url: messageObj.audioMessage.url,
      media_key: messageObj.audioMessage.mediaKey,
      file_enc_sha256: messageObj.audioMessage.fileEncSha256,
      file_sha256: messageObj.audioMessage.fileSha256,
      direct_path: messageObj.audioMessage.directPath,
      mime_type: messageObj.audioMessage.mimetype,
      media_duration: messageObj.audioMessage.seconds
    }
  }
  
  // Imagem
  if (messageObj.imageMessage) {
    return {
      media_url: messageObj.imageMessage.url,
      media_key: messageObj.imageMessage.mediaKey,
      file_enc_sha256: messageObj.imageMessage.fileEncSha256,
      file_sha256: messageObj.imageMessage.fileSha256,
      direct_path: messageObj.imageMessage.directPath,
      mime_type: messageObj.imageMessage.mimetype
    }
  }
  
  // Vídeo
  if (messageObj.videoMessage) {
    return {
      media_url: messageObj.videoMessage.url,
      media_key: messageObj.videoMessage.mediaKey,
      file_enc_sha256: messageObj.videoMessage.fileEncSha256,
      file_sha256: messageObj.videoMessage.fileSha256,
      direct_path: messageObj.videoMessage.directPath,
      mime_type: messageObj.videoMessage.mimetype,
      media_duration: messageObj.videoMessage.seconds
    }
  }
  
  // Documento
  if (messageObj.documentMessage) {
    return {
      media_url: messageObj.documentMessage.url,
      media_key: messageObj.documentMessage.mediaKey,
      file_enc_sha256: messageObj.documentMessage.fileEncSha256,
      file_sha256: messageObj.documentMessage.fileSha256,
      direct_path: messageObj.documentMessage.directPath,
      mime_type: messageObj.documentMessage.mimetype,
      file_name: messageObj.documentMessage.fileName,
      file_length: messageObj.documentMessage.fileLength
    }
  }
  
  return null
}

function extractMessageType(messageObj: any): string {
  if (!messageObj) return 'text'
  
  if (messageObj.conversation || messageObj.extendedTextMessage) return 'text'
  if (messageObj.imageMessage) return 'image'
  if (messageObj.videoMessage) return 'video'
  if (messageObj.audioMessage) return 'audio'
  if (messageObj.documentMessage) return 'document'
  if (messageObj.stickerMessage) return 'sticker'
  if (messageObj.locationMessage) return 'location'
  if (messageObj.contactMessage) return 'contact'
  
  return 'text'
}