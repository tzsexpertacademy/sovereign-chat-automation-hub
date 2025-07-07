
// server/modules/database.js - Funções do Supabase
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./config');

// Inicialização do Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Função para atualizar status do cliente no Supabase
async function updateClientStatus(instanceId, status, phoneNumber = null, qrCode = null, hasQrCode = null, qrExpiresAt = null) {
  try {
    console.log(`📊 Atualizando status no Supabase - Instância: ${instanceId}, Status: ${status}`);
    
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (phoneNumber) updateData.phone_number = phoneNumber;
    if (qrCode !== null) updateData.qr_code = qrCode;
    if (hasQrCode !== null) updateData.has_qr_code = hasQrCode;
    if (qrExpiresAt !== null) updateData.qr_expires_at = qrExpiresAt;

    const { data, error } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('instance_id', instanceId)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar status no Supabase:', error);
      return { success: false, error };
    }

    console.log('✅ Status atualizado no Supabase:', data);
    return { success: true, data };
  } catch (error) {
    console.error('💥 Erro crítico ao atualizar status:', error);
    return { success: false, error: error.message };
  }
}

// Função para salvar mensagem no Supabase
async function saveMessageToSupabase(instanceId, chatId, messageData) {
  try {
    console.log(`💾 Salvando mensagem no Supabase - Chat: ${chatId}`);
    
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        instance_id: instanceId,
        chat_id: chatId,
        message_id: messageData.id,
        body: messageData.body || '',
        from_me: messageData.fromMe || false,
        sender: messageData.from || '',
        timestamp: new Date(messageData.timestamp * 1000).toISOString(),
        message_type: messageData.type || 'chat'
      });

    if (error) {
      console.error('❌ Erro ao salvar mensagem:', error);
      return { success: false, error };
    }

    console.log('✅ Mensagem salva no Supabase');
    return { success: true, data };
  } catch (error) {
    console.error('💥 Erro crítico ao salvar mensagem:', error);
    return { success: false, error: error.message };
  }
}

// Função para sincronizar chats
async function syncChatToSupabase(instanceId, chatData) {
  try {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .upsert({
        instance_id: instanceId,
        chat_id: chatData.id._serialized,
        name: chatData.name || null,
        is_group: chatData.isGroup || false,
        last_message: chatData.lastMessage ? chatData.lastMessage.body : null,
        last_message_time: chatData.lastMessage ? new Date(chatData.lastMessage.timestamp * 1000).toISOString() : null,
        unread_count: chatData.unreadCount || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'instance_id,chat_id' });

    if (error) {
      console.error('❌ Erro ao sincronizar chat:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('💥 Erro crítico ao sincronizar chat:', error);
    return { success: false, error: error.message };
  }
}

// Função para limpar QR codes expirados
async function cleanupExpiredQRCodes() {
  try {
    console.log('🧹 Iniciando limpeza de QR codes expirados...');
    
    const { data, error } = await supabase.rpc('cleanup_expired_qr_codes');
    
    if (error) {
      console.error('❌ Erro na limpeza de QR codes:', error);
      return { success: false, error };
    }
    
    console.log(`✅ Limpeza concluída: ${data} QR codes expirados removidos`);
    return { success: true, count: data };
  } catch (error) {
    console.error('💥 Erro crítico na limpeza:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  supabase,
  updateClientStatus,
  saveMessageToSupabase,
  syncChatToSupabase,
  cleanupExpiredQRCodes
};
