/**
 * 🚀 REAL-TIME MESSAGE SYNC SERVICE V2.0
 * Integração tempo real com CodeChat API v1.3.0
 * 
 * ✅ WebSocket nativo para tempo real
 * ✅ Sync periódico com API
 * ✅ Supabase local cache
 * ✅ Compatibilidade total com CodeChat v1.3.0
 */

import { supabase } from "@/integrations/supabase/client";
import { ticketsService } from "./ticketsService";
import { yumerMessageSyncService } from "./yumerMessageSyncService";

export interface RealTimeSyncConfig {
  clientId: string;
  instanceIds: string[];
  enabled: boolean;
  syncInterval: number;
  apiBaseUrl?: string;
  apiKey?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

class RealTimeMessageSyncService {
  private config: RealTimeSyncConfig | null = null;
  private wsConnections: Map<string, WebSocket> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private status: SyncStatus = 'idle';
  private lastSyncTime: Date | null = null;

  /**
   * Inicializar serviço de tempo real
   */
  async initialize(config: RealTimeSyncConfig): Promise<void> {
    console.log('🚀 [REAL-TIME] Inicializando serviço v2.0...');
    
    this.config = config;
    this.status = 'syncing';

    try {
      if (config.enabled) {
        // 1. Configurar WebSockets para instâncias
        await this.setupWebSockets();
        
        // 2. Configurar sincronização periódica
        this.setupPeriodicSync();
        
        // 3. Sync inicial
        await this.performInitialSync();
      }

      this.status = 'success';
      this.lastSyncTime = new Date();
      
      console.log('✅ [REAL-TIME] Serviço inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ [REAL-TIME] Erro na inicialização:', error);
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Configurar WebSockets para cada instância
   */
  private async setupWebSockets(): Promise<void> {
    if (!this.config) return;

    for (const instanceId of this.config.instanceIds) {
      try {
        // Configurar WebSocket direto com servidor CodeChat
        const wsUrl = `wss://yumer.yumerflow.app:8083/ws/${instanceId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(`🔌 [WEBSOCKET] Conectado à instância: ${instanceId}`);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('❌ [WEBSOCKET] Erro ao processar mensagem:', error);
          }
        };

        ws.onerror = (error) => {
          console.error(`❌ [WEBSOCKET] Erro na instância ${instanceId}:`, error);
        };

        ws.onclose = () => {
          console.log(`🔌 [WEBSOCKET] Desconectado da instância: ${instanceId}`);
          // Tentar reconectar após 5 segundos
          setTimeout(() => this.reconnectWebSocket(instanceId), 5000);
        };

        this.wsConnections.set(instanceId, ws);
        
      } catch (error) {
        console.error(`❌ [WEBSOCKET] Erro ao conectar instância ${instanceId}:`, error);
      }
    }
  }

  /**
   * Reconectar WebSocket
   */
  private reconnectWebSocket(instanceId: string): void {
    console.log(`🔄 [WEBSOCKET] Tentando reconectar: ${instanceId}`);
    
    // Remove conexão antiga
    const oldWs = this.wsConnections.get(instanceId);
    if (oldWs) {
      oldWs.close();
      this.wsConnections.delete(instanceId);
    }

    // Criar nova conexão
    this.setupWebSocketForInstance(instanceId);
  }

  /**
   * Configurar WebSocket para instância específica
   */
  private async setupWebSocketForInstance(instanceId: string): Promise<void> {
    if (!this.config) return;

    try {
      const wsUrl = `wss://yumer.yumerflow.app:8083/ws/${instanceId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`🔌 [WEBSOCKET] Reconectado à instância: ${instanceId}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ [WEBSOCKET] Erro ao processar mensagem:', error);
        }
      };

      this.wsConnections.set(instanceId, ws);
      
    } catch (error) {
      console.error(`❌ [WEBSOCKET] Erro ao reconectar instância ${instanceId}:`, error);
    }
  }

  /**
   * Processar mensagem do WebSocket
   */
  private handleWebSocketMessage(data: any): void {
    console.log('📨 [WEBSOCKET] Nova mensagem recebida:', data);

    // Verificar se é mensagem recebida (não enviada)
    if (data.event === 'messagesUpsert' && !data.data?.keyFromMe) {
      this.processIncomingMessage(data.data);
    }
  }

  /**
   * Processar mensagem recebida
   */
  private async processIncomingMessage(messageData: any): Promise<void> {
    if (!this.config) return;

    try {
      console.log('🔄 [PROCESS] Processando mensagem:', messageData.keyId);

      // 1. Converter para formato padrão
      const standardMessage = this.convertToStandardFormat(messageData);
      
      // 2. Salvar no Supabase
      await this.saveMessageToSupabase(standardMessage);
      
      // 3. Criar/atualizar ticket
      await this.updateConversationTicket(standardMessage);
      
      console.log('✅ [PROCESS] Mensagem processada com sucesso');
      
    } catch (error) {
      console.error('❌ [PROCESS] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Converter mensagem para formato padrão
   */
  private convertToStandardFormat(data: any): any {
    const phoneNumber = data.keyRemoteJid?.replace('@s.whatsapp.net', '') || '';
    
    return {
      message_id: data.keyId,
      instance_id: data.instanceName || this.config?.instanceIds[0],
      chat_id: data.keyRemoteJid,
      sender: phoneNumber,
      body: data.content?.text || data.body || '[mídia]',
      message_type: data.messageType || 'text',
      from_me: data.keyFromMe || false,
      timestamp: new Date(data.messageTimestamp * 1000).toISOString(),
      created_at: new Date().toISOString(),
      is_processed: false,
      sender_name: data.pushName,
      content: data.content?.text || data.body || '[mídia]'
    };
  }

  /**
   * Salvar mensagem no Supabase
   */
  private async saveMessageToSupabase(message: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .upsert({
          message_id: message.message_id,
          instance_id: message.instance_id,
          chat_id: message.chat_id,
          sender: message.sender,
          body: message.body,
          message_type: message.message_type,
          from_me: message.from_me,
          timestamp: message.timestamp,
          created_at: message.created_at,
          is_processed: message.is_processed
        }, {
          onConflict: 'message_id,instance_id'
        });

      if (error) throw error;
      
      console.log('💾 [SUPABASE] Mensagem salva:', message.message_id);
      
    } catch (error) {
      console.error('❌ [SUPABASE] Erro ao salvar:', error);
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
        message.sender_name || 'Contato',
        message.sender,
        message.content,
        message.timestamp
      );
      
      console.log('🎫 [TICKET] Atualizado para:', message.chat_id);
      
    } catch (error) {
      console.error('❌ [TICKET] Erro ao atualizar:', error);
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
      this.status = 'syncing';
      
      // Sincronizar mensagens não processadas do Yumer
      await yumerMessageSyncService.convertUnprocessedMessages(this.config.clientId);
      
      this.status = 'success';
      this.lastSyncTime = new Date();
      
      console.log('✅ [PERIODIC-SYNC] Concluído');
      
    } catch (error) {
      console.error('❌ [PERIODIC-SYNC] Erro:', error);
      this.status = 'error';
    }
  }

  /**
   * Executar sync inicial
   */
  private async performInitialSync(): Promise<void> {
    if (!this.config) return;

    console.log('🎯 [INITIAL-SYNC] Executando sync inicial...');

    try {
      // Converter mensagens não processadas
      await yumerMessageSyncService.convertUnprocessedMessages(this.config.clientId);
      
      console.log('✅ [INITIAL-SYNC] Concluído');
      
    } catch (error) {
      console.error('❌ [INITIAL-SYNC] Erro:', error);
      throw error;
    }
  }

  /**
   * Forçar sincronização manual
   */
  async forceSyncMessages(): Promise<void> {
    if (!this.config) {
      throw new Error('Serviço não inicializado');
    }

    console.log('🎯 [FORCE-SYNC] Iniciando sincronização forçada...');

    try {
      this.status = 'syncing';
      
      // Executar sync completo
      await yumerMessageSyncService.convertUnprocessedMessages(this.config.clientId);
      
      this.status = 'success';
      this.lastSyncTime = new Date();
      
      console.log('✅ [FORCE-SYNC] Sincronização forçada concluída');
      
    } catch (error) {
      console.error('❌ [FORCE-SYNC] Erro:', error);
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Parar serviço
   */
  stop(): void {
    console.log('🛑 [REAL-TIME] Parando serviço...');

    // Fechar WebSockets
    this.wsConnections.forEach((ws, instanceId) => {
      console.log(`🔌 [WEBSOCKET] Fechando conexão: ${instanceId}`);
      ws.close();
    });
    this.wsConnections.clear();

    // Limpar interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Reset estado
    this.config = null;
    this.status = 'idle';
    this.lastSyncTime = null;

    console.log('✅ [REAL-TIME] Serviço parado');
  }

  /**
   * Obter status atual
   */
  getStatus(): { status: SyncStatus; lastSyncTime: Date | null } {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Verificar se está ativo
   */
  isActive(): boolean {
    return this.config !== null && this.status !== 'idle';
  }
}

export const realTimeMessageSyncService = new RealTimeMessageSyncService();