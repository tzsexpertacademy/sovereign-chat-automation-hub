
// server/modules/database.js - Database CORRIGIDO com validações
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./config');

// Criar cliente Supabase com configuração corrigida
let supabase;

try {
  console.log('🔗 Inicializando cliente Supabase...');
  console.log(`📍 URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
  
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });
  
  console.log('✅ Cliente Supabase inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Supabase:', error);
  process.exit(1);
}

// Função para testar conectividade com Supabase
async function testSupabaseConnection() {
  try {
    console.log('🧪 Testando conectividade com Supabase...');
    
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Conectividade com Supabase confirmada');
    return true;
  } catch (error) {
    console.error('❌ Erro na conectividade com Supabase:', error);
    return false;
  }
}

// Executar teste de conectividade na inicialização
testSupabaseConnection();

// Função para atualizar status do cliente com validação
async function updateClientStatus(instanceId, status, phoneNumber = null, qrCode = null, hasQrCode = false, qrExpiresAt = null) {
  try {
    if (!instanceId) {
      throw new Error('instanceId é obrigatório');
    }
    
    if (!status) {
      throw new Error('status é obrigatório');
    }
    
    console.log(`📊 Atualizando status: ${instanceId} -> ${status}`);
    
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (phoneNumber) updateData.phone_number = phoneNumber;
    if (qrCode) updateData.qr_code = qrCode;
    if (hasQrCode !== null) updateData.has_qr_code = hasQrCode;
    if (qrExpiresAt) updateData.qr_expires_at = qrExpiresAt;
    
    // Limpar QR code se status não for qr_ready
    if (status !== 'qr_ready') {
      updateData.qr_code = null;
      updateData.has_qr_code = false;
      updateData.qr_expires_at = null;
    }
    
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('instance_id', instanceId)
      .select();
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Status atualizado para ${instanceId}: ${status}`);
    return data;
  } catch (error) {
    console.error(`❌ Erro ao atualizar status para ${instanceId}:`, error);
    throw error;
  }
}

// Função para salvar mensagem no Supabase
async function saveMessageToSupabase(instanceId, chatId, messageData) {
  try {
    if (!instanceId || !chatId || !messageData) {
      throw new Error('Dados incompletos para salvar mensagem');
    }
    
    console.log(`💾 Salvando mensagem: ${instanceId} - ${chatId}`);
    
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        instance_id: instanceId,
        chat_id: chatId,
        message_id: messageData.id,
        body: messageData.body || '',
        from_me: messageData.fromMe || false,
        message_type: messageData.type || 'text',
        timestamp: messageData.timestamp ? new Date(messageData.timestamp * 1000).toISOString() : new Date().toISOString(),
        sender: messageData.from || chatId
      });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Mensagem salva: ${instanceId} - ${chatId}`);
    return data;
  } catch (error) {
    console.error(`❌ Erro ao salvar mensagem ${instanceId}:`, error);
    throw error;
  }
}

// Função para sincronizar chat no Supabase
async function syncChatToSupabase(instanceId, chat) {
  try {
    if (!instanceId || !chat) {
      throw new Error('Dados incompletos para sincronizar chat');
    }
    
    console.log(`🔄 Sincronizando chat: ${instanceId} - ${chat.id._serialized}`);
    
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .upsert({
        instance_id: instanceId,
        chat_id: chat.id._serialized,
        name: chat.name || 'Chat sem nome',
        is_group: chat.isGroup || false,
        last_message: chat.lastMessage?.body || null,
        last_message_time: chat.lastMessage?.timestamp ? 
          new Date(chat.lastMessage.timestamp * 1000).toISOString() : null,
        unread_count: chat.unreadCount || 0
      }, {
        onConflict: 'instance_id,chat_id'
      });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Chat sincronizado: ${instanceId} - ${chat.id._serialized}`);
    return data;
  } catch (error) {
    console.error(`❌ Erro ao sincronizar chat ${instanceId}:`, error);
    throw error;
  }
}

// Função para limpeza de QR codes expirados
async function cleanupExpiredQRCodes() {
  try {
    console.log('🧹 Limpando QR codes expirados...');
    
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: null,
        has_qr_code: false,
        qr_expires_at: null,
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .lt('qr_expires_at', new Date().toISOString())
      .not('qr_expires_at', 'is', null);
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ QR codes expirados limpos: ${data?.length || 0} registros`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao limpar QR codes expirados:', error);
    return null;
  }
}

// Executar limpeza de QR codes a cada 2 minutos
setInterval(cleanupExpiredQRCodes, 2 * 60 * 1000);

// Função para obter estatísticas do banco
async function getDatabaseStats() {
  try {
    const [instancesResult, messagesResult, chatsResult] = await Promise.all([
      supabase.from('whatsapp_instances').select('status', { count: 'exact' }),
      supabase.from('whatsapp_messages').select('id', { count: 'exact' }),
      supabase.from('whatsapp_chats').select('id', { count: 'exact' })
    ]);
    
    return {
      totalInstances: instancesResult.count || 0,
      totalMessages: messagesResult.count || 0,
      totalChats: chatsResult.count || 0,
      instancesByStatus: instancesResult.data?.reduce((acc, instance) => {
        acc[instance.status] = (acc[instance.status] || 0) + 1;
        return acc;
      }, {}) || {}
    };
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas do banco:', error);
    return null;
  }
}

module.exports = {
  supabase,
  updateClientStatus,
  saveMessageToSupabase,
  syncChatToSupabase,
  cleanupExpiredQRCodes,
  getDatabaseStats,
  testSupabaseConnection
};
