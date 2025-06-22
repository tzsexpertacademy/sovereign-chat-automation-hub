
import { supabase } from '@/integrations/supabase/client';

class PresenceService {
  private presenceIntervals: Map<string, NodeJS.Timeout> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Manter status online ativo (simulado localmente)
  async maintainOnlineStatus(clientId: string, enable: boolean = true) {
    if (enable) {
      // Limpar intervalo anterior se existir
      const existingInterval = this.presenceIntervals.get(clientId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      console.log(`👤 Status online simulado ativado para ${clientId}`);

      // Simular manutenção de status online (sem chamadas HTTP)
      const interval = setInterval(() => {
        console.log(`👤 Status online mantido (simulado) para ${clientId}`);
      }, 60000); // A cada 1 minuto

      this.presenceIntervals.set(clientId, interval);
    } else {
      // Parar manutenção de presença
      const interval = this.presenceIntervals.get(clientId);
      if (interval) {
        clearInterval(interval);
        this.presenceIntervals.delete(clientId);
      }
      console.log(`👤 Status online desativado para ${clientId}`);
    }
  }

  // Mostrar indicador de digitação (simulado)
  async showTyping(clientId: string, chatId: string, duration: number = 3000) {
    try {
      console.log(`⌨️ Simulando digitação para ${chatId} (${duration}ms)`);
      
      // Limpar timeout anterior se existir
      const existingTimeout = this.typingTimeouts.get(`${clientId}_${chatId}`);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Atualizar estado no banco para mostrar digitação
      await supabase
        .from('whatsapp_chats')
        .upsert({
          chat_id: chatId,
          instance_id: clientId,
          is_typing: true,
          typing_started_at: new Date().toISOString()
        }, {
          onConflict: 'chat_id,instance_id'
        });

      // Parar digitação após duração especificada
      const timeout = setTimeout(async () => {
        try {
          await supabase
            .from('whatsapp_chats')
            .update({
              is_typing: false,
              typing_started_at: null
            })
            .eq('chat_id', chatId)
            .eq('instance_id', clientId);
          
          console.log(`⌨️ Digitação parada para ${chatId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao parar digitação:`, error);
        }
        this.typingTimeouts.delete(`${clientId}_${chatId}`);
      }, duration);

      this.typingTimeouts.set(`${clientId}_${chatId}`, timeout);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao simular digitação:`, error);
      return false;
    }
  }

  // Mostrar indicador de gravação (simulado)
  async showRecording(clientId: string, chatId: string, duration: number = 2000) {
    try {
      console.log(`🎤 Simulando gravação para ${chatId} (${duration}ms)`);
      
      // Atualizar estado no banco para mostrar gravação
      await supabase
        .from('whatsapp_chats')
        .upsert({
          chat_id: chatId,
          instance_id: clientId,
          is_recording: true
        }, {
          onConflict: 'chat_id,instance_id'
        });

      // Parar gravação após duração especificada
      setTimeout(async () => {
        try {
          await supabase
            .from('whatsapp_chats')
            .update({
              is_recording: false
            })
            .eq('chat_id', chatId)
            .eq('instance_id', clientId);
          
          console.log(`🎤 Gravação parada para ${chatId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao parar gravação:`, error);
        }
      }, duration);

      return true;
    } catch (error) {
      console.log(`❌ Erro ao simular gravação:`, error);
      return false;
    }
  }

  // Marcar mensagens como lidas (simulado)
  async markAsRead(clientId: string, chatId: string, messageIds: string[]) {
    try {
      console.log(`✓✓ Simulando leitura de ${messageIds.length} mensagens em ${chatId}`);
      
      // Simular delay de leitura realista
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      console.log(`✅ Mensagens marcadas como lidas (simulado)`);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao simular leitura:`, error);
      return false;
    }
  }

  // Cleanup ao desconectar
  cleanup(clientId: string) {
    const interval = this.presenceIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.presenceIntervals.delete(clientId);
    }

    // Limpar todos os timeouts de digitação deste cliente
    for (const [key, timeout] of this.typingTimeouts.entries()) {
      if (key.startsWith(clientId)) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(key);
      }
    }
    
    console.log(`🧹 Cleanup realizado para ${clientId}`);
  }

  // Cleanup geral
  cleanupAll() {
    for (const interval of this.presenceIntervals.values()) {
      clearInterval(interval);
    }
    this.presenceIntervals.clear();

    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();
    
    console.log(`🧹 Cleanup geral realizado`);
  }
}

export const presenceService = new PresenceService();
