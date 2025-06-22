
import { whatsappService } from './whatsappMultiClient';

class PresenceService {
  private presenceIntervals: Map<string, NodeJS.Timeout> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Manter status online ativo
  async maintainOnlineStatus(clientId: string, enable: boolean = true) {
    if (enable) {
      // Limpar intervalo anterior se existir
      const existingInterval = this.presenceIntervals.get(clientId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      // Definir como online imediatamente
      try {
        await whatsappService.updatePresence(clientId, 'available');
        console.log(`👤 Status online ativado para ${clientId}`);
      } catch (error) {
        console.log(`⚠️ Erro ao definir status online para ${clientId}:`, error);
      }

      // Manter online a cada 30 segundos
      const interval = setInterval(async () => {
        try {
          await whatsappService.updatePresence(clientId, 'available');
          console.log(`👤 Status online mantido para ${clientId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao manter status online para ${clientId}:`, error);
        }
      }, 30000);

      this.presenceIntervals.set(clientId, interval);
    } else {
      // Parar manutenção de presença
      const interval = this.presenceIntervals.get(clientId);
      if (interval) {
        clearInterval(interval);
        this.presenceIntervals.delete(clientId);
      }
    }
  }

  // Mostrar indicador de digitação
  async showTyping(clientId: string, chatId: string, duration: number = 3000) {
    try {
      console.log(`⌨️ Mostrando digitação para ${chatId}`);
      
      // Limpar timeout anterior se existir
      const existingTimeout = this.typingTimeouts.get(`${clientId}_${chatId}`);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Mostrar digitação
      await whatsappService.setTyping(clientId, chatId, true);
      await whatsappService.updatePresence(clientId, 'composing');

      // Parar digitação após duração especificada
      const timeout = setTimeout(async () => {
        try {
          await whatsappService.setTyping(clientId, chatId, false);
          await whatsappService.updatePresence(clientId, 'available');
          console.log(`⌨️ Digitação parada para ${chatId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao parar digitação:`, error);
        }
        this.typingTimeouts.delete(`${clientId}_${chatId}`);
      }, duration);

      this.typingTimeouts.set(`${clientId}_${chatId}`, timeout);
    } catch (error) {
      console.log(`❌ Erro ao mostrar digitação:`, error);
    }
  }

  // Mostrar indicador de gravação
  async showRecording(clientId: string, chatId: string, duration: number = 2000) {
    try {
      console.log(`🎤 Mostrando gravação para ${chatId}`);
      
      // Mostrar gravação
      await whatsappService.setRecording(clientId, chatId, true);
      await whatsappService.updatePresence(clientId, 'recording');

      // Parar gravação após duração especificada
      setTimeout(async () => {
        try {
          await whatsappService.setRecording(clientId, chatId, false);
          await whatsappService.updatePresence(clientId, 'available');
          console.log(`🎤 Gravação parada para ${chatId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao parar gravação:`, error);
        }
      }, duration);
    } catch (error) {
      console.log(`❌ Erro ao mostrar gravação:`, error);
    }
  }

  // Marcar mensagens como lidas
  async markAsRead(clientId: string, chatId: string, messageIds: string[]) {
    try {
      console.log(`✓✓ Marcando ${messageIds.length} mensagens como lidas em ${chatId}`);
      
      for (const messageId of messageIds) {
        await whatsappService.markAsRead(clientId, chatId, messageId);
      }

      console.log(`✅ Mensagens marcadas como lidas com sucesso`);
    } catch (error) {
      console.log(`❌ Erro ao marcar mensagens como lidas:`, error);
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
  }
}

export const presenceService = new PresenceService();
