
import { supabase } from '@/integrations/supabase/client';
import { codeChatApiService } from './codechatApiService';
import { ticketsService } from './ticketsService';

interface RealTimeConfig {
  clientId: string;
  instanceId: string;
  onNewMessage?: (message: any) => void;
  onNewTicket?: (ticket: any) => void;
  onConnectionChange?: (status: string) => void;
}

class RealTimeMessageSync {
  private config: RealTimeConfig | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private supabaseChannel: any = null;
  private isRunning = false;
  private lastSyncTime = new Date();

  // Inicializar sistema de tempo real
  start(config: RealTimeConfig) {
    console.log('🚀 [REALTIME] Iniciando sistema de tempo real:', config.clientId);
    
    this.config = config;
    this.isRunning = true;
    
    // 1. Configurar listeners Supabase (tempo real local)
    this.setupSupabaseListeners();
    
    // 2. Configurar sync periódico (backup)
    this.setupPeriodicSync();
    
    // 3. Configurar webhook na instância CodeChat
    this.setupWebhookConfiguration();
  }

  // Parar sistema de tempo real
  stop() {
    console.log('⏹️ [REALTIME] Parando sistema de tempo real');
    
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.supabaseChannel) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    
    this.config = null;
  }

  // === SUPABASE REALTIME (LOCAL) ===
  private setupSupabaseListeners() {
    if (!this.config) return;
    
    console.log('🔔 [REALTIME] Configurando listeners Supabase...');
    
    // Listener para novas mensagens
    this.supabaseChannel = supabase
      .channel(`realtime-client-${this.config.clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=in.(${this.getClientTicketIds()})`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Nova mensagem via Supabase:', payload.new);
          this.config?.onNewMessage?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${this.config.clientId}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Novo ticket via Supabase:', payload.new);
          this.config?.onNewTicket?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `client_id=eq.${this.config.clientId}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Status instância atualizado:', payload.new);
          this.config?.onConnectionChange?.((payload.new as any).status);
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Status Supabase:', status);
      });
  }

  // === SYNC PERIÓDICO (BACKUP) ===
  private setupPeriodicSync() {
    if (!this.config) return;
    
    console.log('⏰ [REALTIME] Configurando sync periódico a cada 30s...');
    
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return;
      
      try {
        console.log('🔄 [REALTIME] Executando sync periódico...');
        await this.syncRecentMessages();
        await this.syncRecentTickets();
      } catch (error) {
        console.error('❌ [REALTIME] Erro no sync periódico:', error);
      }
    }, 30000); // 30 segundos
  }

  // === CONFIGURAÇÃO WEBHOOK CODECHAT ===
  private async setupWebhookConfiguration() {
    if (!this.config) return;
    
    try {
      console.log('🔧 [REALTIME] Configurando webhook na instância CodeChat...');
      
      // URL do webhook Supabase
      const webhookUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-webhook';
      
      // Configurar webhook na instância
      const response = await fetch(`https://yumer.yumerflow.app:8083/webhook/set/${this.config.instanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getInstanceToken()}`
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          events: {
            // Eventos de mensagens (CRÍTICO)
            'messagesUpsert': true,
            'message.upsert': true,
            
            // Eventos de QR Code
            'qrcodeUpdated': true,
            'qrcode.updated': true,
            
            // Eventos de conexão
            'connectionUpdated': true,
            'connection.update': true,
            
            // Outros eventos importantes
            'chatsUpsert': true,
            'contactsUpsert': true,
            'statusInstance': true,
            
            // Desabilitar eventos desnecessários
            'messagesSet': false,
            'chatsSet': false,
            'contactsSet': false
          }
        })
      });
      
      if (response.ok) {
        console.log('✅ [REALTIME] Webhook configurado com sucesso');
      } else {
        const error = await response.text();
        console.error('❌ [REALTIME] Erro ao configurar webhook:', error);
      }
    } catch (error) {
      console.error('❌ [REALTIME] Erro crítico na configuração do webhook:', error);
    }
  }

  // === SYNC DE MENSAGENS RECENTES ===
  private async syncRecentMessages() {
    if (!this.config) return;
    
    try {
      // Buscar mensagens recentes da API CodeChat
      const messages = await codeChatApiService.findMessages(
        this.config.instanceId,
        '', // Todas as conversas
        20,  // Últimas 20 mensagens
        0    // Offset 0
      );
      
      if (messages.length > 0) {
        console.log(`🔄 [SYNC] ${messages.length} mensagens sincronizadas`);
        
        // Processar mensagens que ainda não existem no banco
        for (const message of messages) {
          await this.processMessageIfNew(message);
        }
      }
    } catch (error) {
      console.warn('⚠️ [SYNC] Erro ao sincronizar mensagens:', error);
    }
  }

  // === SYNC DE TICKETS RECENTES ===
  private async syncRecentTickets() {
    if (!this.config) return;
    
    try {
      // Buscar chats recentes da API CodeChat
      const chats = await codeChatApiService.findChats(this.config.instanceId, {
        limit: 20,
        useMessages: true
      });
      
      if (chats.length > 0) {
        console.log(`🔄 [SYNC] ${chats.length} chats sincronizados`);
        
        // Processar chats que ainda não são tickets
        for (const chat of chats) {
          await this.processChatAsTicketIfNew(chat);
        }
      }
    } catch (error) {
      console.warn('⚠️ [SYNC] Erro ao sincronizar tickets:', error);
    }
  }

  // === FUNÇÕES AUXILIARES ===

  private async getInstanceToken(): Promise<string> {
    if (!this.config) throw new Error('Config não inicializada');
    
    // Buscar token da instância no banco
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('auth_token')
      .eq('instance_id', this.config.instanceId)
      .single();
    
    return instance?.auth_token || '';
  }

  private getClientTicketIds(): string {
    // Esta função deveria retornar IDs dos tickets do cliente
    // Por simplicidade, retornamos uma consulta que filtra por client_id
    return `SELECT id FROM conversation_tickets WHERE client_id = '${this.config?.clientId}'`;
  }

  private async processMessageIfNew(message: any) {
    if (!this.config) return;
    
    // Verificar se mensagem já existe
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('message_id', message.keyId)
      .eq('instance_id', this.config.instanceId)
      .single();
    
    if (!existing) {
      console.log('📨 [SYNC] Nova mensagem detectada, processando...');
      
      // Usar o mesmo processamento do webhook
      const normalizedMessage = this.normalizeApiMessage(message);
      
      // Criar/atualizar customer e ticket
      const customerId = await this.createOrUpdateCustomerFromMessage(normalizedMessage);
      const ticketId = await this.createOrUpdateTicketFromMessage(normalizedMessage, customerId);
      
      // Notificar listeners
      this.config.onNewMessage?.(normalizedMessage);
    }
  }

  private async processChatAsTicketIfNew(chat: any) {
    if (!this.config) return;
    
    // Verificar se ticket já existe
    const { data: existing } = await supabase
      .from('conversation_tickets')
      .select('id')
      .eq('chat_id', chat.id)
      .eq('client_id', this.config.clientId)
      .single();
    
    if (!existing) {
      console.log('🎫 [SYNC] Novo ticket detectado, criando...');
      
      // Criar ticket a partir do chat
      const ticket = await ticketsService.createTicketFromChat(this.config.clientId, chat);
      
      // Notificar listeners
      this.config.onNewTicket?.(ticket);
    }
  }

  private normalizeApiMessage(message: any) {
    return {
      messageId: message.keyId,
      chatId: message.keyRemoteJid,
      fromMe: message.keyFromMe,
      content: this.extractMessageContent(message.content),
      messageType: message.messageType,
      timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
      contactName: message.pushName || 'Contato',
      phoneNumber: this.extractPhoneNumber(message.keyRemoteJid),
      sender: message.pushName || 'Contato'
    };
  }

  private extractMessageContent(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.text || content.conversation || content.caption || '[Mídia]';
  }

  private extractPhoneNumber(remoteJid: string): string {
    if (!remoteJid) return '';
    let phone = remoteJid.split('@')[0];
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('55') && phone.length >= 12) {
      phone = phone.slice(2);
    }
    return phone;
  }

  private async createOrUpdateCustomerFromMessage(messageData: any): Promise<string> {
    if (!this.config) throw new Error('Config não inicializada');
    
    return await ticketsService.createOrUpdateCustomer(this.config.clientId, messageData);
  }

  private async createOrUpdateTicketFromMessage(messageData: any, customerId: string): Promise<string> {
    if (!this.config) throw new Error('Config não inicializada');
    
    return await ticketsService.createOrUpdateTicket(
      this.config.clientId,
      this.config.instanceId,
      messageData,
      customerId
    );
  }
}

// Singleton instance
export const realTimeMessageSync = new RealTimeMessageSync();

// Export para usar em components
export default realTimeMessageSync;
