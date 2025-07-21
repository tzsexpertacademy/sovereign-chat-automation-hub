
/**
 * =====================================================
 * REAL TIME MESSAGE SYNC - TEMPO REAL IGUAL WHATSAPP
 * =====================================================
 * 
 * Sistema híbrido para sincronização em tempo real:
 * 1. Supabase = Base local com dados existentes
 * 2. API Server = Fonte de mensagens novas
 * 3. WebSocket = Notificações instantâneas
 */

import { supabase } from '@/integrations/supabase/client';
import { yumerNativeWebSocketService } from './yumerNativeWebSocketService';
import { yumerMessageSyncService } from './yumerMessageSyncService';
import { ticketsService } from './ticketsService';

export interface RealTimeConfig {
  clientId: string;
  instanceIds: string[];
  enabled: boolean;
  syncInterval: number;
}

class RealTimeMessageSyncService {
  private config: RealTimeConfig | null = null;
  private isConnected = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Inicializar sincronização em tempo real
   */
  async initialize(config: RealTimeConfig): Promise<void> {
    this.config = config;
    
    if (!config.enabled) {
      console.log('🔕 [REALTIME-SYNC] Sincronização desabilitada');
      return;
    }

    console.log('🚀 [REALTIME-SYNC] Inicializando tempo real para cliente:', config.clientId);
    console.log('📡 [REALTIME-SYNC] Instâncias:', config.instanceIds);

    try {
      // 1. Configurar WebSocket para notificações instantâneas
      await this.setupWebSocketConnection();
      
      // 2. Configurar sincronização periódica
      this.setupPeriodicSync();
      
      // 3. Configurar listeners Supabase para atualizações locais
      this.setupSupabaseListeners();
      
      this.isConnected = true;
      console.log('✅ [REALTIME-SYNC] Sistema tempo real ativo!');
      
    } catch (error) {
      console.error('❌ [REALTIME-SYNC] Erro na inicialização:', error);
      throw error;
    }
  }

  /**
   * Configurar WebSocket para mensagens instantâneas
   */
  private async setupWebSocketConnection(): Promise<void> {
    if (!this.config) return;

    try {
      // Conectar ao WebSocket do servidor Yumer
      await yumerNativeWebSocketService.connect({
        instanceName: this.config.instanceIds[0], // Usar primeira instância
        event: 'messagesUpsert',
        useSecureConnection: true,
        autoReconnect: true,
        maxReconnectAttempts: 10
      });

      // Escutar mensagens em tempo real
      yumerNativeWebSocketService.on('message_received', (data) => {
        this.handleRealtimeMessage(data);
      });

      // Escutar eventos de status de instância
      yumerNativeWebSocketService.on('instance_status', (data) => {
        this.handleInstanceStatusUpdate(data);
      });

      console.log('🔌 [REALTIME-SYNC] WebSocket conectado');

    } catch (error) {
      console.error('❌ [REALTIME-SYNC] Erro no WebSocket:', error);
      // Continuar sem WebSocket (modo polling apenas)
    }
  }

  /**
   * Processar mensagem recebida em tempo real
   */
  private async handleRealtimeMessage(data: any): Promise<void> {
    try {
      console.log('📨 [REALTIME-MESSAGE] Nova mensagem:', data);
      
      if (!this.config) return;

      // Verificar se a mensagem é de uma das nossas instâncias
      if (!this.config.instanceIds.includes(data.instanceName)) {
        return;
      }

      // Processar mensagem e criar/atualizar ticket
      await this.processIncomingMessage(data);
      
      // Notificar listeners
      this.notifyListeners('new_message', data);
      
    } catch (error) {
      console.error('❌ [REALTIME-MESSAGE] Erro ao processar:', error);
    }
  }

  /**
   * Processar mensagem e sincronizar com Supabase
   */
  private async processIncomingMessage(messageData: any): Promise<void> {
    if (!this.config) return;

    try {
      // 1. Converter para formato padrão
      const standardMessage = this.convertToStandardFormat(messageData);
      
      // 2. Salvar no banco Supabase
      await this.saveMessageToSupabase(standardMessage);
      
      // 3. Criar/atualizar ticket de conversa
      await this.updateConversationTicket(standardMessage);
      
      console.log('✅ [REALTIME-PROCESS] Mensagem processada:', standardMessage.message_id);
      
    } catch (error) {
      console.error('❌ [REALTIME-PROCESS] Erro:', error);
    }
  }

  /**
   * Converter mensagem para formato padrão
   */
  private convertToStandardFormat(data: any): any {
    return {
      message_id: data.id || data.keyId,
      instance_id: data.instanceName,
      chat_id: data.keyRemoteJid || data.chatId,
      sender_phone: data.keyRemoteJid?.replace('@s.whatsapp.net', ''),
      sender_name: data.pushName || 'Contato',
      content: data.content?.text || data.body || '[mídia]',
      message_type: data.messageType || 'text',
      from_me: data.keyFromMe || false,
      timestamp: new Date(data.messageTimestamp * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Salvar mensagem no Supabase
   */
  private async saveMessageToSupabase(message: any): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_messages')
      .upsert(message, { 
        onConflict: 'message_id,instance_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('❌ [SAVE-MESSAGE] Erro ao salvar:', error);
    } else {
      console.log('💾 [SAVE-MESSAGE] Salva:', message.message_id);
    }
  }

  /**
   * Atualizar ticket de conversa
   */
  private async updateConversationTicket(message: any): Promise<void> {
    if (!this.config || message.from_me) return;

    try {
      await ticketsService.createOrUpdateTicketFromMessage(
        this.config.clientId,
        message.chat_id,
        message.instance_id,
        message.sender_name,
        message.sender_phone,
        message.content,
        message.timestamp
      );
      
      console.log('🎫 [TICKET-UPDATE] Ticket atualizado para:', message.sender_phone);
      
    } catch (error) {
      console.error('❌ [TICKET-UPDATE] Erro:', error);
    }
  }

  /**
   * Configurar sincronização periódica
   */
  private setupPeriodicSync(): void {
    if (!this.config) return;

    // Limpar interval anterior
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sincronização a cada 30 segundos
    this.syncInterval = setInterval(async () => {
      try {
        await this.performPeriodicSync();
      } catch (error) {
        console.error('❌ [PERIODIC-SYNC] Erro:', error);
      }
    }, this.config.syncInterval || 30000);

    console.log('⏱️ [PERIODIC-SYNC] Configurado:', this.config.syncInterval || 30000, 'ms');
  }

  /**
   * Executar sincronização periódica
   */
  private async performPeriodicSync(): Promise<void> {
    if (!this.config) return;

    console.log('🔄 [PERIODIC-SYNC] Executando...');

    try {
      // Sincronizar mensagens não processadas
      const result = await yumerMessageSyncService.convertUnprocessedMessages(this.config.clientId);
      
      if (result.converted > 0) {
        console.log(`✅ [PERIODIC-SYNC] ${result.converted} mensagens sincronizadas`);
        this.notifyListeners('sync_complete', result);
      }
      
    } catch (error) {
      console.error('❌ [PERIODIC-SYNC] Erro:', error);
    }
  }

  /**
   * Configurar listeners Supabase para mudanças locais
   */
  private setupSupabaseListeners(): void {
    if (!this.config) return;

    // Escutar mudanças em tickets
    supabase
      .channel(`realtime-tickets-${this.config.clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${this.config.clientId}`
        },
        (payload) => {
          console.log('🎫 [SUPABASE-REALTIME] Ticket alterado:', payload.eventType);
          this.notifyListeners('ticket_changed', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages'
        },
        (payload) => {
          console.log('📨 [SUPABASE-REALTIME] Mensagem alterada:', payload.eventType);
          this.notifyListeners('message_changed', payload);
        }
      )
      .subscribe();

    console.log('👂 [SUPABASE-REALTIME] Listeners configurados');
  }

  /**
   * Atualizar status de instância
   */
  private handleInstanceStatusUpdate(data: any): void {
    console.log('📡 [INSTANCE-STATUS]', data.instanceName, '→', data.status);
    this.notifyListeners('instance_status', data);
  }

  /**
   * Adicionar listener para eventos
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remover listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notificar listeners
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ [LISTENER] Erro no callback:', error);
      }
    });
  }

  /**
   * Parar sincronização
   */
  stop(): void {
    console.log('🛑 [REALTIME-SYNC] Parando...');
    
    this.isConnected = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    yumerNativeWebSocketService.disconnect();
    this.listeners.clear();
    
    console.log('✅ [REALTIME-SYNC] Parado');
  }

  /**
   * Status da conexão
   */
  getStatus(): { connected: boolean; config: RealTimeConfig | null } {
    return {
      connected: this.isConnected,
      config: this.config
    };
  }

  /**
   * Forçar sincronização manual
   */
  async forcSync(): Promise<any> {
    if (!this.config) {
      throw new Error('Serviço não inicializado');
    }

    console.log('🔄 [FORCE-SYNC] Iniciando sincronização manual...');
    
    try {
      const result = await yumerMessageSyncService.convertUnprocessedMessages(this.config.clientId);
      
      console.log('✅ [FORCE-SYNC] Concluída:', result);
      this.notifyListeners('sync_complete', result);
      
      return result;
    } catch (error) {
      console.error('❌ [FORCE-SYNC] Erro:', error);
      throw error;
    }
  }
}

export const realTimeMessageSyncService = new RealTimeMessageSyncService();
